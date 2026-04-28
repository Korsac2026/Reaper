

/* Decompiler 6ms, total 160ms, lines 21 */
package dev.obamaruntz;

import io.javalin.http.Context;
import io.javalin.http.UnauthorizedResponse;
import io.javalin.security.RouteRole;
import java.util.Set;

public class Auth {
    public static void handleAccess(Context ctx) {
        Set<RouteRole> permittedRoles = ctx.routeRoles();
        if (!permittedRoles.contains(Roles.ANYONE)) {
            Boolean authenticated = (Boolean)ctx.sessionAttribute("authenticated");
            if (authenticated == null || !authenticated) {
                ctx.header("WWW-Authenticate", "Bearer");
                throw new UnauthorizedResponse("401");
            }
        }
    }
}