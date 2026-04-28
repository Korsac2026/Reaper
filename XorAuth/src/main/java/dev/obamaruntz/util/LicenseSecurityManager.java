

/* Decompiler 20ms, total 130ms, lines 49 */
package dev.obamaruntz.util;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

public class LicenseSecurityManager {
    private static final int HWID_VALIDATION_SALT = "ADMeNRp5hr9w8QELAZUZwkhFiiY9BU5zN0QmKmhY8LRq3CP4QgyHJwn651tCy4RvvMSpi8XBdZBGuzGBV6UmwUB9ZCNRFARR5TwZWP20XQNfuac3a6aCNWrVpaFuUMveWntfqEktvJxE4ZKzfT18i8nwRyZreXDjzh0c33CJeTqTy0cBPv8FJQW0az3Ev9PJ0gXKQ3JFje6TLjyxCVFVjV3xZ2bPffqURyD2V1SBA8v0WkAL0kHtXky2mEjU869NXx4zURpzV6F8upGyDX9NugqzkdWuEn8Hd2MjvyJj8583rPuELFJW9RqGwq3mZBDVFfyXmfkBGcXR4A1NxK4KqPRy6RHc5ECW9D2qYA4Px32DcAMU89HVrMYjTN31vaCucNcQRg8ewNXenM3P7ZErtBYE9WRpL1NSWGrcmXupqh1QPyzTKQ5RqxtY2Xj2u8bYEBDbhJ8MBHN0CFGf2JJDPKFwUZq1RFQ2x4kRh2A4vTq3iaqApJr3zHA6Q0Chkdajf6KZRZeUdZ8vJTnxyza41vkcw1QwRX4pnaHHZE8tQAGr6furcxULY7D6VWJnn9x8Rpv6RvY5KUA7dG89EP9t5WmbKMrbhu9eS6zJqY4iDnpT090tkHdWpH685YZvKKFd2iHgJ5WwatmcQ6hd8pqXQAgYGmxSenYPMcQ8Znm2pzg8vxtHmeAcEcP5GSeNcR21cWwXJx4n99WbFVdSEWn1jk2f1M4aAeN4t4NMqrVQquF4mBPQan0rXVyLGE1zpCMk9ae79Py4Y5exXpFN7n7Qc0hG55KEZDbJmxG4tj48SuMbTpQwFXRSBCi6D1vM4qhykB2X3AcZ1JMe8QRHfkVUnJp5MfuJrAvpFvnz9Vazbgiw7hjhuHHWQdcBYySY3pQ0BypKHCmqDPrQTNh5LJcrwDwAFkuUVJ4NAK7mhzEizEQFWax8iHXBrDVfMrLu4aXVu3zCztEVpe9Smm9U4h4WYcKrxPFYg2Q2H9zCC85U83ThAykfh5QzEJKuRU24CmJt".hashCode();

    public String generateHwidToken(String originalHwid, String licenseKey) {
        String rawToken = originalHwid + licenseKey + HWID_VALIDATION_SALT;
        return this.hashSHA256(rawToken);
    }

    public boolean isHwidValid(String storedHwid, String submittedHwid, String licenseKey) {
        String expectedToken = this.generateHwidToken(storedHwid, licenseKey);
        String submittedToken = this.generateHwidToken(submittedHwid, licenseKey);
        return expectedToken.equals(submittedToken);
    }

    private String hashSHA256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] encodedhash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            return this.bytesToHex(encodedhash);
        } catch (NoSuchAlgorithmException var4) {
            return null;
        }
    }

    private String bytesToHex(byte[] hash) {
        StringBuilder hexString = new StringBuilder(2 * hash.length);
        byte[] var3 = hash;
        int var4 = hash.length;

        for(int var5 = 0; var5 < var4; ++var5) {
            byte b = var3[var5];
            String hex = Integer.toHexString(255 & b);
            if (hex.length() == 1) {
                hexString.append('0');
            }

            hexString.append(hex);
        }

        return hexString.toString();
    }
}

