

/* Decompiler 216ms, total 500ms, lines 353 */
package dev.obamaruntz;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.obamaruntz.database.LicenseService;
import dev.obamaruntz.database.UserService;
import dev.obamaruntz.database.entities.License;
import dev.obamaruntz.database.entities.User;
import io.javalin.Javalin;
import io.javalin.apibuilder.ApiBuilder;
import io.javalin.http.Context;
import io.javalin.http.util.RateLimiter;
import io.javalin.json.JavalinJackson;
import io.javalin.security.RouteRole;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.security.Security;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import org.conscrypt.Conscrypt;
import org.json.JSONObject;

public class Main {
    public static final String ADMIN_KEY = "";
    private static LicenseService licenseService;
    private static UserService userService;

    public static void main(String[] args) throws SQLException {
        licenseService = new LicenseService("licenses.db");
        userService = new UserService("licenses.db", licenseService);
        Security.insertProviderAt(Conscrypt.newProvider(), 1);
        RateLimiter rateLimiter = new RateLimiter(TimeUnit.MINUTES);
        JavalinJackson.defaultMapper();
        
        int port = 8080;
        if (System.getenv("PORT") != null) {
            port = Integer.parseInt(System.getenv("PORT"));
        }

        Javalin app = Javalin.create((config) -> {
            config.staticFiles.add("/public/js");
            config.router.mount((router) -> {
                router.beforeMatched(Auth::handleAccess);
            }).apiBuilder(() -> {
                ApiBuilder.get("/", (ctx) -> {
                    rateLimiter.incrementCounter(ctx, 20);
                    renderPage(ctx, "login");
                }, new RouteRole[]{Roles.ANYONE});
                ApiBuilder.post("/login", (ctx) -> {
                    rateLimiter.incrementCounter(ctx, 20);
                    String enteredKey = ctx.formParam("apiKey");
                    if (Objects.equals(enteredKey, "UKQzqF6WCUyN42c1JqSXk91HPacj8x23vp2NWLDSgQdxEfEDu2XDeu1ZRLQdV2U6kQ93LQEz0WvCkdi5ytd42uKeLYiGvpu5cgbTtabwhpfe18yAxA0t5AGdTYYmp0jLwLrS11DzR6EgP0Pmw9FVNibEgm1bXP66zV6xDmnetv53jHNNFeFKrPp8PVQN1tzbjvFBCGpj4iEvxQ3Vwr3c9i4jWZ7aU3NbTydKNXvKYBzVah6w0fCeCPKnLvyzwxCtHYABRcN0Pgy00CrRwqFKDFREQu4e0HmWHpApkt49nKUmX3Xpd9mdp5FEzjupQ5fDdz32vtQm53xpHK98cDSctJTzn4DLS6cXAFkK2tc2EG3YZ6CKZvQQcTcccNzqhmLUhBYBcQDzFrvygqfG6vvm4K6zCNbmqh9R07uKEkGg3a5XUPThZRdTqCgjaVdY4T9V5eHJHKF81EWjNYfMZhfyG9Q1UuiFFHRduxTNT4hHtPhjpp7q3AcRM4TNdqUKkE31GUVN3cvhX2RcXGG9BLE6yqkAMpgTz2EJEBw72afWT1uDZ7c5FNt5EibLeUYzpRTg07tz3HpgM7jciMLT9pkq1nNYMQSEWS4pYRZ1eXG8NDcFciDnNvNNfWv5h0bN9HiNFCEhuE3Mq6ppMRYfRZqcp1G6G1KW1iWkSSQP1pfDxkXSL8eew68wNpt408qpcYfZejQyLgREt0zearpeaY9NgyJm48Ce2euB5Bmu5mkSAcykyMyP680qbycJDP8Gjey2RXZyhVgYU43qgJbGi024d0GLfLNdfqKcznKYnRbYHrHH0kdUef0CACjHeGLb3QRpgVEe7LWBmdkHPNM0kmAyvSvDKNQNek4Nd9Z9dTtnhNgXnxecDVKDrCqgkP2j9RHTDTAw383KKbTAGjMq1RjkFiJ7PyC4k4g0MwFGRDbaaUgh31uRPfep59fYdZw2iVHCcx3L7RjfjGrbE27jSmB5YjTqbKMDYvUqtED9QLTx2Jd2XEW3YzDBWtutSyRZc5ZL")) {
                        ctx.sessionAttribute("authenticated", true);
                        ctx.redirect("/dashboard");
                    } else {
                        ctx.redirect("/login");
                    }

                }, new RouteRole[]{Roles.ANYONE});
                ApiBuilder.get("/login", (ctx) -> {
                    rateLimiter.incrementCounter(ctx, 20);
                    renderPage(ctx, "login");
                }, new RouteRole[]{Roles.ANYONE});
                ApiBuilder.get("/logout", (ctx) -> {
                    rateLimiter.incrementCounter(ctx, 20);
                    ctx.sessionAttribute("authenticated", (Object)null);
                    ctx.redirect("/login");
                }, new RouteRole[]{Roles.ANYONE});
                ApiBuilder.get("/dashboard", (ctx) -> {
                    renderPage(ctx, "dashboard");
                }, new RouteRole[]{Roles.ADMIN});
                ApiBuilder.post("/api/licenses", Main::generateLicenses, new RouteRole[]{Roles.ADMIN});
                ApiBuilder.get("/api/licenses", (ctx) -> {
                    List<License> licenses = licenseService.getAllLicenses();
                    ctx.json(licenses);
                }, new RouteRole[]{Roles.ADMIN});
                ApiBuilder.delete("/api/licenses", (ctx) -> {
                    licenseService.deleteAllLicenses();
                }, new RouteRole[]{Roles.ADMIN});
                ApiBuilder.delete("/api/licenses/used", (ctx) -> {
                    licenseService.deleteAllUsedLicenses();
                }, new RouteRole[]{Roles.ADMIN});
                ApiBuilder.delete("/api/licenses/unused", (ctx) -> {
                    licenseService.deleteAllUnusedLicenses();
                }, new RouteRole[]{Roles.ADMIN});
                ApiBuilder.post("/api/licenses/extend", (ctx) -> {
                    Map json = (Map)(new ObjectMapper()).readValue(ctx.body(), Map.class);
                    String licenseKey = (String)json.get("licenseKey");
                    int hours = json.get("hours") instanceof Number ? ((Number)json.get("hours")).intValue() : -1;
                    if (licenseKey != null && hours > 0) {
                        boolean success = licenseService.extendLicense(licenseKey, hours);
                        if (success) {
                            ctx.json(Map.of("success", true));
                        } else {
                            ctx.json(Map.of("success", false, "error", "Failed to extend license"));
                        }
                    } else {
                        ctx.json(Map.of("success", false, "error", "Invalid input"));
                    }

                }, new RouteRole[]{Roles.ADMIN});
                ApiBuilder.post("/api/licenses/note", (ctx) -> {
                    Map json = (Map)(new ObjectMapper()).readValue(ctx.body(), Map.class);
                    System.out.println("Received JSON: " + ctx.body());
                    String licenseKey = (String)json.get("licenseKey");
                    String note = json.get("note").toString();
                    if (licenseKey == null) {
                        ctx.json(Map.of("success", false, "error", "Invalid input"));
                    } else {
                        boolean success = licenseService.changeNote(licenseKey, note);
                        if (success) {
                            ctx.json(Map.of("success", true));
                        } else {
                            ctx.json(Map.of("success", false, "error", "Failed to change note"));
                        }
                    }

                }, new RouteRole[]{Roles.ADMIN});
                ApiBuilder.post("/api/licenses/delete", (ctx) -> {
                    Map json = (Map)(new ObjectMapper()).readValue(ctx.body(), Map.class);
                    String licenseKey = (String)json.get("licenseKey");
                    if (licenseKey == null) {
                        ctx.json(Map.of("success", false, "error", "Invalid input"));
                    } else {
                        boolean success = licenseService.deleteLicense(licenseKey);
                        if (success) {
                            ctx.json(Map.of("success", true));
                        } else {
                            ctx.json(Map.of("success", false, "error", "Failed to change note"));
                        }
                    }

                }, new RouteRole[]{Roles.ADMIN});
                ApiBuilder.get("/api/users", (ctx) -> {
                    List<User> users = userService.getAllUsers();
                    ctx.json(users);
                }, new RouteRole[]{Roles.ADMIN});
                ApiBuilder.post("/api/users/key", (ctx) -> {
                    rateLimiter.incrementCounter(ctx, 20);
                    Map json = (Map)(new ObjectMapper()).readValue(ctx.body(), Map.class);
                    String licenseKey = (String)json.get("licenseKey");
                    if (licenseKey == null) {
                        ctx.json(Map.of("success", false, "error", "Invalid input"));
                    } else {
                        Map<String, Object> lookupResult = userService.lookupUser(licenseKey);
                        ctx.json(lookupResult);
                    }

                }, new RouteRole[]{Roles.ANYONE});
                ApiBuilder.post("/api/users/login", (ctx) -> {
                    rateLimiter.incrementCounter(ctx, 20);
                    Map json = (Map)(new ObjectMapper()).readValue(ctx.body(), Map.class);
                    String licenseKey = (String)json.get("licenseKey");
                    String hwid = (String)json.get("hwid");
                    String ipv4 = (String)json.get("ipv4");
                    if (licenseKey != null && hwid != null && ipv4 != null) {
                        Map<String, Object> loginResult = userService.loginUser(licenseKey, hwid, ipv4);
                        ctx.json(loginResult);
                    } else {
                        ctx.json(Map.of("success", false, "error", "Invalid input"));
                    }

                }, new RouteRole[]{Roles.ANYONE});
                ApiBuilder.post("/api/users/register", (ctx) -> {
                    rateLimiter.incrementCounter(ctx, 20);
                    Map json = (Map)(new ObjectMapper()).readValue(ctx.body(), Map.class);
                    String licenseKey = (String)json.get("licenseKey");
                    String hwid = (String)json.get("hwid");
                    String ipv4 = (String)json.get("ipv4");
                    if (licenseKey != null && hwid != null && ipv4 != null) {
                        Map<String, Object> registrationResult = userService.registerUser(licenseKey, hwid, ipv4);
                        ctx.json(registrationResult);
                    } else {
                        ctx.json(Map.of("success", false, "error", "Invalid input"));
                    }

                }, new RouteRole[]{Roles.ANYONE});
                ApiBuilder.post("/api/licenses/extendall", (ctx) -> {
                    Map json = (Map)(new ObjectMapper()).readValue(ctx.body(), Map.class);
                    int hours = json.get("hours") instanceof Number ? ((Number)json.get("hours")).intValue() : -1;
                    if (hours <= 0) {
                        ctx.json(Map.of("success", false, "error", "Invalid input"));
                    } else {
                        boolean status = licenseService.extendAllLicenses(hours);
                        if (status) {
                            ctx.json(Map.of("success", true));
                        } else {
                            ctx.json(Map.of("success", false, "error", "Failed to extend all licenses"));
                        }
                    }

                }, new RouteRole[]{Roles.ADMIN});
                ApiBuilder.post("/api/users/toggleBan", (ctx) -> {
                    Map json = (Map)(new ObjectMapper()).readValue(ctx.body(), Map.class);
                    Integer id = (Integer)json.get("userId");
                    if (id == null) {
                        ctx.json(Map.of("success", false, "error", "Invalid input"));
                    } else {
                        boolean success = userService.toggleBan(id);
                        if (success) {
                            ctx.json(Map.of("success", true));
                        } else {
                            ctx.json(Map.of("success", false, "error", "Failed to ban user."));
                        }
                    }

                }, new RouteRole[]{Roles.ADMIN});
                ApiBuilder.post("/api/users/resetHwid", (ctx) -> {
                    Map json = (Map)(new ObjectMapper()).readValue(ctx.body(), Map.class);
                    Integer id = (Integer)json.get("userId");
                    if (id == null) {
                        ctx.json(Map.of("success", false, "error", "Invalid input"));
                    } else {
                        boolean success = userService.resetHwid(id);
                        if (success) {
                            ctx.json(Map.of("success", true));
                        } else {
                            ctx.json(Map.of("success", false, "error", "Failed to reset users hwid."));
                        }
                    }

                }, new RouteRole[]{Roles.ADMIN});
                ApiBuilder.delete("/api/users", (ctx) -> {
                    Map json = (Map)(new ObjectMapper()).readValue(ctx.body(), Map.class);
                    Integer id = (Integer)json.get("userId");
                    if (id == null) {
                        ctx.json(Map.of("success", false, "error", "Invalid input"));
                    } else {
                        boolean success = userService.deleteUser(id);
                        if (success) {
                            ctx.json(Map.of("success", true));
                        } else {
                            ctx.json(Map.of("success", false, "error", "Failed to reset users hwid."));
                        }
                    }

                }, new RouteRole[]{Roles.ADMIN});
                ApiBuilder.post("/api/users/info", (ctx) -> {
                    rateLimiter.incrementCounter(ctx, 20);
                    Map json = (Map)(new ObjectMapper()).readValue(ctx.body(), Map.class);
                    String licenseKey = (String)json.get("licenseKey");

                    if (licenseKey != null) {
                        Map<String, Object> registrationResult = userService.getKeyInfo(licenseKey);
                        ctx.json(registrationResult);
                    } else {
                        ctx.json(Map.of("success", false, "error", "Invalid input"));
                    }
                }, new RouteRole[]{Roles.ANYONE});
            });
        }).start(port);
    }

    private static void generateLicenses(Context ctx) {
        try {
            JSONObject formData = new JSONObject(ctx.body());
            int amount = formData.getInt("amount");
            String prefix = formData.getString("prefix");
            String mask = formData.getString("mask");
            String note = formData.getString("notes");
            long expiryTimestamp = formData.optLong("expiryTimestamp", 0L);
            List<String> generatedKeys = new ArrayList();

            for(int i = 0; i < amount; ++i) {
                String licenseKey = generateLicenseKey(mask, prefix);
                licenseService.addLicenseKey(licenseKey, expiryTimestamp, note);
                generatedKeys.add(licenseKey);
            }
        } catch (Exception var11) {
            var11.printStackTrace();
        }

    }

    private static String generateLicenseKey(String mask, String prefix) {
        StringBuilder key = new StringBuilder(prefix);
        String alphanumeric = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        char[] var4 = mask.toCharArray();
        int var5 = var4.length;

        for(int var6 = 0; var6 < var5; ++var6) {
            char c = var4[var6];
            if (c != 'X' && c != 'x') {
                if (c != 'A' && c != 'a') {
                    if (c != 'N' && c != 'n') {
                        key.append(c);
                    } else {
                        key.append((int)(Math.random() * 10.0D));
                    }
                } else {
                    key.append((char)((int)(65.0D + Math.random() * 26.0D)));
                }
            } else {
                key.append(alphanumeric.charAt((int)(Math.random() * (double)alphanumeric.length())));
            }
        }

        return key.toString();
    }

    private static void renderPage(Context ctx, String pageName) {
        try {
            String htmlContent = loadResourceAsString("/public/" + pageName + ".html");
            ctx.contentType("text/html").result(htmlContent);
        } catch (Exception var3) {
            ctx.status(404).result("Page not found");
        }

    }

    private static String loadResourceAsString(String resourcePath) throws Exception {
        InputStream is = Main.class.getResourceAsStream(resourcePath);

        String var3;
        try {
            if (is == null) {
                throw new Exception("Resource not found: " + resourcePath);
            }

            BufferedReader reader = new BufferedReader(new InputStreamReader(is));

            try {
                var3 = (String)reader.lines().collect(Collectors.joining("\n"));
            } catch (Throwable var8) {
                try {
                    reader.close();
                } catch (Throwable var7) {
                    var8.addSuppressed(var7);
                }

                throw var8;
            }

            reader.close();
        } catch (Throwable var9) {
            if (is != null) {
                try {
                    is.close();
                } catch (Throwable var6) {
                    var9.addSuppressed(var6);
                }
            }

            throw var9;
        }

        if (is != null) {
            is.close();
        }

        return var3;
    }
}