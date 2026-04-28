

/* Decompiler 31ms, total 187ms, lines 142 */
package dev.obamaruntz.database;

import com.j256.ormlite.dao.Dao;
import com.j256.ormlite.dao.DaoManager;
import com.j256.ormlite.jdbc.JdbcConnectionSource;
import com.j256.ormlite.stmt.PreparedQuery;
import com.j256.ormlite.stmt.QueryBuilder;
import com.j256.ormlite.support.ConnectionSource;
import com.j256.ormlite.table.TableUtils;
import dev.obamaruntz.database.entities.User;
import dev.obamaruntz.util.LicenseSecurityManager;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;

public class UserService {
    private final Dao<User, Integer> userDao;
    private final LicenseService licenseService;

    public UserService(String path, LicenseService licenseService) throws SQLException {
        this.licenseService = licenseService;
        ConnectionSource connectionSource = new JdbcConnectionSource("jdbc:sqlite:" + path);
        TableUtils.createTableIfNotExists(connectionSource, User.class);
        this.userDao = DaoManager.createDao(connectionSource, User.class);
    }

    public List<User> getAllUsers() throws SQLException {
        return this.userDao.queryForAll();
    }

    public Map<String, Object> registerUser(String identifier, String hwid, String ipv4) throws SQLException {
        if (!this.licenseService.exists(identifier)) {
            return Map.of("success", false, "message", "Invalid license key");
        } else if (this.licenseService.isUsed(identifier)) {
            return Map.of("success", false, "message", "License key already in use");
        } else if (ipv4.equals("0")) {
            return Map.of("success", false, "message", "Invalid IP address");
        } else {
            User existingUser = (User)this.userDao.queryForEq("hwid", hwid).stream().findFirst().orElse((User)null);
            if (existingUser != null) {
                this.licenseService.resetUsage(identifier);
                existingUser.setLicenseKey(identifier);
                existingUser.setIpv4(ipv4);
                existingUser.setLastLoginDate(System.currentTimeMillis());
                existingUser.setExpiry(System.currentTimeMillis() + this.licenseService.getExpiration(identifier));
                int rowsUpdated = this.userDao.update(existingUser);
                if (rowsUpdated > 0) {
                    this.licenseService.setKeyUsage(identifier, true);
                    return Map.of("success", true, "message", "User key updated successfully");
                } else {
                    return Map.of("success", false, "message", "Failed to update user key");
                }
            } else {
                User user = new User();
                user.setLicenseKey(identifier);
                user.setHwid(hwid);
                user.setIpv4(ipv4);
                user.setCreationDate(System.currentTimeMillis());
                user.setLastLoginDate(0L);
                user.setExpiry(System.currentTimeMillis() + this.licenseService.getExpiration(identifier));
                int rowsInserted = this.userDao.create(user);
                if (rowsInserted > 0) {
                    this.licenseService.setKeyUsage(identifier, true);
                    return Map.of("success", true, "message", "User registered successfully");
                } else {
                    return Map.of("success", false, "message", "Registration failed");
                }
            }
        }
    }

    public Map<String, Object> lookupUser(String identifier) throws SQLException {
        User existingUser = (User)this.userDao.queryForEq("licenseKey", identifier).stream().findFirst().orElse((User)null);
        return existingUser != null ? Map.of("success", true, "message", "Successfully retrieved user", "remaining_time", this.licenseService.getExpiration(existingUser.getLicenseKey()), "user_id", existingUser.getId()) : Map.of("success", false, "message", "No user associated with this identifier");
    }

    public boolean toggleBan(int id) throws SQLException {
        User user = (User)this.userDao.queryForId(id);
        if (user == null) {
            return false;
        } else {
            user.setBanned(!user.isBanned());
            int updateResult = this.userDao.update(user);
            return updateResult > 0;
        }
    }

    public boolean resetHwid(int id) throws SQLException {
        User user = (User)this.userDao.queryForId(id);
        if (user == null) {
            return false;
        } else {
            user.setHwid("0");
            int updateResult = this.userDao.update(user);
            return updateResult > 0;
        }
    }

    public boolean deleteUser(int id) throws SQLException {
        User user = (User)this.userDao.queryForId(id);
        if (user != null) {
            int rowsDeleted = this.userDao.delete(user);
            return rowsDeleted > 0;
        } else {
            return false;
        }
    }

    public User findByLicenseKey(String licenseKey) throws SQLException {
        QueryBuilder<User, Integer> queryBuilder = this.userDao.queryBuilder();
        queryBuilder.where().eq("licenseKey", licenseKey);
        PreparedQuery<User> preparedQuery = queryBuilder.prepare();
        List<User> results = this.userDao.query(preparedQuery);
        return results.isEmpty() ? null : (User)results.getFirst();
    }

    public Map<String, Object> loginUser(String identifier, String hwid, String ipv4) throws SQLException {
        LicenseSecurityManager securityManager = new LicenseSecurityManager();
        User existingUser = this.findByLicenseKey(identifier);
        if (existingUser == null) {
            return Map.of("success", false, "message", "User not found");
        } else {
            if (existingUser.getHwid().equals("0")) {
                existingUser.setHwid(hwid);
                this.userDao.update(existingUser);
            } else if (!securityManager.isHwidValid(existingUser.getHwid(), hwid, identifier)) {
                return Map.of("success", false, "message", "Hardware ID verification failed");
            }

            if (existingUser.isBanned()) {
                return Map.of("success", false, "message", "User is banned");
            } else if (existingUser.getExpiry() < System.currentTimeMillis()) {
                return Map.of("success", false, "message", "License has expired");
            } else {
                existingUser.setLastLoginDate(System.currentTimeMillis());
                this.userDao.update(existingUser);
                return Map.of("success", true, "message", "Login successful");
            }
        }
    }

    public Map<String, Object> getKeyInfo(String licenseKey) throws SQLException {
        User existingUser = this.findByLicenseKey(licenseKey);
        if (existingUser == null) {
            return Map.of("success", false, "message", "User not found");
        } else {
            return Map.of("success", true, "expiry", existingUser.getExpiry(), "id", existingUser.getId());
        }
    }
}

