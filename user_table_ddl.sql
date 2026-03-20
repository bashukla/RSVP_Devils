-- CREATE TABLE user (
--     email VARCHAR(255) PRIMARY KEY,
--     password VARCHAR(255) NOT NULL,
--     user_id int AUTO_INCREMENT UNIQUE
-- );

-- CREATE TABLE events (
--     event_id INT AUTO_INCREMENT PRIMARY KEY,
--     type VARCHAR(255) NOT NULL,
--     description VARCHAR(255),
--     event_datetime DATETIME NOT NULL,
--     location VARCHAR(255) NOT NULL,
--     created_by INT NOT NULL,
--     FOREIGN KEY (created_by) REFERENCES user(user_id) 

-- );

-- CREATE TABLE registration (
--     regId INT AUTO_INCREMENT PRIMARY KEY,
--     user_id INT NOT NULL,
--     event_id INT NOT NULL,
--     reg_at DATETIME DEFAULT CURRENT_TIMESTAMP,
--     FOREIGN KEY (user_id) REFERENCES user(user_id),
--     FOREIGN KEY (event_id) REFERENCES events(event_id),
--     UNIQUE (user_id,event_id)
-- );

CREATE TABLE IF NOT EXISTS `user_reminders` (
    `reminder_id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NOT NULL,
    `event_id` INT NOT NULL,
    `is_active` TINYINT(1) DEFAULT 1,
    `email_sent` TINYINT(1) DEFAULT 0,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`user_id`) REFERENCES `user`(`user_id`) ON DELETE CASCADE,
    FOREIGN KEY (`event_id`) REFERENCES `events`(`event_id`) ON DELETE CASCADE,
    UNIQUE KEY `unique_user_event` (`user_id`, `event_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;