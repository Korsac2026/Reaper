

/* Decompiler 37ms, total 157ms, lines 140 */
package dev.obamaruntz.database;

import com.j256.ormlite.dao.Dao;
import com.j256.ormlite.dao.DaoManager;
import com.j256.ormlite.jdbc.JdbcConnectionSource;
import com.j256.ormlite.stmt.DeleteBuilder;
import com.j256.ormlite.support.ConnectionSource;
import com.j256.ormlite.table.TableUtils;
import dev.obamaruntz.database.entities.License;
import java.sql.SQLException;
import java.util.Iterator;
import java.util.List;

public class LicenseService {
    private final Dao<License, String> licenseDao;

    public LicenseService(String path) throws SQLException {
        ConnectionSource connectionSource = new JdbcConnectionSource("jdbc:sqlite:" + path);
        TableUtils.createTableIfNotExists(connectionSource, License.class);
        this.licenseDao = DaoManager.createDao(connectionSource, License.class);
    }

    public void addLicenseKey(String licenseKey, long expiry, String note) throws SQLException {
        License licenseObj = new License();
        licenseObj.setLicenseKey(licenseKey);
        licenseObj.setCreationDate(System.currentTimeMillis());
        licenseObj.setExpiry(expiry);
        licenseObj.setNote(note);
        this.licenseDao.create(licenseObj);
    }

    public boolean isExpired(String licenseKey) throws SQLException {
        License licenseObj = (License)this.licenseDao.queryForId(licenseKey);
        if (licenseObj == null) {
            return false;
        } else {
            long timestamp = System.currentTimeMillis();
            return licenseObj.getExpiry() < timestamp || licenseObj.getExpiry() == 0L;
        }
    }

    public boolean isUsed(String licenseKey) throws SQLException {
        License licenseObj = (License)this.licenseDao.queryForId(licenseKey);
        return licenseObj != null ? licenseObj.getUsed() : false;
    }

    public void setKeyUsage(String licenseKey, boolean used) throws SQLException {
        License licenseObj = (License)this.licenseDao.queryForId(licenseKey);
        if (licenseObj != null) {
            licenseObj.setUsed(used);
            this.licenseDao.update(licenseObj);
        }
    }

    public boolean exists(String licenseKey) throws SQLException {
        License licenseObj = (License)this.licenseDao.queryForId(licenseKey);
        return licenseObj != null;
    }

    public List<License> getAllLicenses() throws SQLException {
        return this.licenseDao.queryForAll();
    }

    public void deleteAllLicenses() throws SQLException {
        this.licenseDao.deleteBuilder().delete();
    }

    public void deleteAllUsedLicenses() throws SQLException {
        DeleteBuilder<License, String> deleteBuilder = this.licenseDao.deleteBuilder();
        deleteBuilder.where().eq("used", true);
        deleteBuilder.delete();
    }

    public void deleteAllUnusedLicenses() throws SQLException {
        DeleteBuilder<License, String> deleteBuilder = this.licenseDao.deleteBuilder();
        deleteBuilder.where().eq("used", false);
        deleteBuilder.delete();
    }

    public boolean extendLicense(String licenseKey, int hours) throws SQLException {
        License licenseObj = (License)this.licenseDao.queryForId(licenseKey);
        if (licenseObj != null) {
            licenseObj.setExpiry(licenseObj.getExpiry() + (long)hours * 3600000L);
            this.licenseDao.update(licenseObj);
            return true;
        } else {
            return false;
        }
    }

    public boolean extendAllLicenses(int hours) throws SQLException {
        List<License> licenseObjList = this.licenseDao.queryForAll();
        Iterator var3 = licenseObjList.iterator();
        if (var3.hasNext()) {
            License licenseObj = (License)var3.next();
            licenseObj.setExpiry(licenseObj.getExpiry() + (long)hours * 3600000L);
            this.licenseDao.update(licenseObj);
            return true;
        } else {
            return false;
        }
    }

    public boolean changeNote(String licenseKey, String note) throws SQLException {
        License licenseObj = (License)this.licenseDao.queryForId(licenseKey);
        if (licenseObj != null) {
            licenseObj.setNote(note);
            this.licenseDao.update(licenseObj);
            return true;
        } else {
            return false;
        }
    }

    public boolean deleteLicense(String licenseKey) throws SQLException {
        License licenseObj = (License)this.licenseDao.queryForId(licenseKey);
        if (licenseObj != null) {
            int rowsDeleted = this.licenseDao.delete(licenseObj);
            return rowsDeleted > 0;
        } else {
            return false;
        }
    }

    public long getExpiration(String licenseKey) throws SQLException {
        License licenseObj = (License)this.licenseDao.queryForId(licenseKey);
        return licenseObj != null ? licenseObj.getExpiry() : 0L;
    }

    public void resetUsage(String licenseKey) throws SQLException {
        License licenseObj = (License)this.licenseDao.queryForId(licenseKey);
        if (licenseObj != null) {
            licenseObj.setUsed(false);
            this.licenseDao.update(licenseObj);
        }

    }
}

