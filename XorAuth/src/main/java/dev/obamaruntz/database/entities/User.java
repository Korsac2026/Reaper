

/* Decompiler 14ms, total 399ms, lines 97 */
package dev.obamaruntz.database.entities;

import com.j256.ormlite.field.DatabaseField;
import com.j256.ormlite.table.DatabaseTable;

@DatabaseTable(
        tableName = "users"
)
public class User {
    @DatabaseField(
            canBeNull = false,
            generatedId = true
    )
    private int id;
    @DatabaseField(
            canBeNull = false
    )
    private String licenseKey;
    @DatabaseField(
            canBeNull = false
    )
    private String hwid;
    @DatabaseField(
            canBeNull = false
    )
    private String ipv4;
    @DatabaseField(
            canBeNull = false
    )
    private long creationDate;
    @DatabaseField(
            canBeNull = false
    )
    private long lastLoginDate;
    @DatabaseField(
            canBeNull = false,
            defaultValue = "false"
    )
    private boolean banned;
    @DatabaseField(
            canBeNull = false,
            defaultValue = "0"
    )
    private long expiry;

    public int getId() {
        return this.id;
    }

    public void setId(int id) {
        this.id = id;
    }

    public String getLicenseKey() {
        return this.licenseKey;
    }

    public void setLicenseKey(String licenseKey) {
        this.licenseKey = licenseKey;
    }

    public String getHwid() {
        return this.hwid;
    }

    public void setHwid(String hwid) {
        this.hwid = hwid;
    }

    public String getIpv4() {
        return this.ipv4;
    }

    public void setIpv4(String ipv4) {
        this.ipv4 = ipv4;
    }

    public long getCreationDate() {
        return this.creationDate;
    }

    public void setCreationDate(long creationDate) {
        this.creationDate = creationDate;
    }

    public long getLastLoginDate() {
        return this.lastLoginDate;
    }

    public void setLastLoginDate(long lastLoginDate) {
        this.lastLoginDate = lastLoginDate;
    }

    public boolean isBanned() {
        return this.banned;
    }

    public void setBanned(boolean banned) {
        this.banned = banned;
    }

    public long getExpiry() {
        return this.expiry;
    }

    public void setExpiry(long expiry) {
        this.expiry = expiry;
    }
}

