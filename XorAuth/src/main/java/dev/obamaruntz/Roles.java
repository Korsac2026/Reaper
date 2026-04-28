

/* Decompiler 5ms, total 123ms, lines 15 */
package dev.obamaruntz;

import io.javalin.security.RouteRole;

enum Roles implements RouteRole {
    ANYONE,
    ADMIN,
    READ;

}

