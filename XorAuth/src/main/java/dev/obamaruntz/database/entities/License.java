

/* Decompiler 10ms, total 347ms, lines 86 */
package dev.obamaruntz.database.entities;

import com.j256.ormlite.field.DatabaseField;
import com.j256.ormlite.table.DatabaseTable;

@DatabaseTable(
        tableName = "licenses"
)
public class License {
    @DatabaseField(
            id = true,
            canBeNull = false
    )
    private String licenseKey;
    @DatabaseField(
            canBeNull = false
    )
    private long creationDate;
    @DatabaseField(
            canBeNull = false
    )
    private long expiry;
    @DatabaseField(
            canBeNull = false,
            defaultValue = "false"
    )
    private Boolean used;
    @DatabaseField(
            canBeNull = false,
            defaultValue = "false"
    )
    private Boolean banned;
    @DatabaseField(
            canBeNull = true
    )
    private String note;

    public long getExpiry() {
        return this.expiry;
    }

    public void setExpiry(long expiry) {
        this.expiry = expiry;
    }

    public Boolean getUsed() {
        return this.used;
    }

    public void setUsed(Boolean used) {
        this.used = used;
    }

    public String getNote() {
        return this.note;
    }

    public void setNote(String note) {
        this.note = note;
    }

    public Boolean getBanned() {
        return this.banned;
    }

    public void setBanned(Boolean banned) {
        this.banned = banned;
    }

    public long getCreationDate() {
        return this.creationDate;
    }

    public void setCreationDate(long creationDate) {
        this.creationDate = creationDate;
    }

    public String getLicenseKey() {
        return this.licenseKey;
    }

    public void setLicenseKey(String licenseKey) {
        this.licenseKey = licenseKey;
    }
}

