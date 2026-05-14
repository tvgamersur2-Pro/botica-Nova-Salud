USE nova_salud;
UPDATE users SET password_hash='$2b$12$4JYyi7dy7Lcdube5T7qTsuTNIWN/cXfG3upt/le/OMk8VrvNmvARC' WHERE username='admin';
SELECT username, LEFT(password_hash, 20) as hash_preview FROM users WHERE username='admin';
