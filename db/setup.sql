-- Drop database if it exists
DROP DATABASE IF EXISTS `ReviveScotland`;

-- Create database
CREATE DATABASE `ReviveScotland`;

-- Use the newly created database
USE `ReviveScotland`;

-- Drop tables if they already exist
DROP TABLE IF EXISTS `EventRegister`;
DROP TABLE IF EXISTS `Events`;
DROP TABLE IF EXISTS `Login`;
DROP TABLE IF EXISTS `Policies`;

-- Table to store user logins
CREATE TABLE `Login` (
  `id` CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `email` VARCHAR(100) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `permissions` VARCHAR(50) NOT NULL,
  `last_login` DATETIME
);

-- Table to store policies
CREATE TABLE `Policies` (
  `id` CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `title` VARCHAR(100) NOT NULL,
  `description` TEXT NOT NULL
);

-- Table to store events
CREATE TABLE `Events` (
  `id` CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `title` VARCHAR(100) NOT NULL,
  `description` VARCHAR(200) DEFAULT '' NOT NULL,
  `date_from` DATETIME NOT NULL,
  `date_to` DATETIME,
  `location` VARCHAR(255) NOT NULL,
  `poster_link` TEXT DEFAULT '' NOT NULL,
  `featured_image` TEXT DEFAULT '' NOT NULL,
  `timetable_link` TEXT DEFAULT '' NOT NULL,
  `price` DECIMAL(10, 2),
  `suggested_price` BOOLEAN DEFAULT TRUE,
  `policy_id` CHAR(36),
  `gdpr_id` CHAR(36),
  CONSTRAINT `fk_policy`
      FOREIGN KEY(`policy_id`)
          REFERENCES `Policies`(`id`),
  CONSTRAINT `fk_gdpr`
      FOREIGN KEY(`gdpr_id`)
          REFERENCES `Policies`(`id`)
);

-- Table to store event registrations
CREATE TABLE `EventRegister` (
  `id` CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `event_id` CHAR(36) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `telephone` VARCHAR(20) NOT NULL,
  `email` VARCHAR(100) NOT NULL,
  `emergency_contact` VARCHAR(100) NOT NULL,
  `dob` DATE,
  `allergies_or_medical_requirements` TEXT NOT NULL,
  `accepted_gdpr` BOOLEAN DEFAULT FALSE,
  `accepted_event_policy` BOOLEAN DEFAULT FALSE,
  `paid` BOOLEAN DEFAULT FALSE,
  CONSTRAINT `fk_event`
      FOREIGN KEY(`event_id`)
          REFERENCES `Events`(`id`)
);

-- Insert row into Login table with default password
-- admin:G7uaw54J7EtbcQehv1FO
INSERT INTO `Login` (`id`, `username`, `email`, `password`, `permissions`, `last_login`)
  VALUES (UUID(), 'admin', 'revivescotlandx@gmail.com', '$2y$10$C5l93.2xzxRaWnGNMIMmNuhpUH5VB3W4s3JGM7lJNEAsvwyGV2hqG', 'admin', NULL);

-- Insert default policies
INSERT INTO `Policies` (`id`, `title`, `description`)
VALUES
    (UUID(), 'Event Policy', 'This is an exemplary text for the Event Policy.'),
    (UUID(), 'GDPR Policy', 'This is an exemplary text for the GDPR Policy.');

-- Insert 4 events with placeholder text and default boolean values
INSERT INTO `Events` (`id`, `title`, `date_from`, `date_to`, `location`, `poster_link`, `timetable_link`, `price`, `suggested_price`, `policy_id`, `gdpr_id`)
VALUES
    (UUID(), 'Event 1', NOW() + INTERVAL 6 MONTH, NULL, 'Location 1', 'poster1.jpg', 'timetable1.pdf', 10.00, FALSE, (SELECT `id` FROM `Policies` WHERE `title` = 'Event Policy'), (SELECT `id` FROM `Policies` WHERE `title` = 'GDPR Policy')),
    (UUID(), 'Event 2', NOW() + INTERVAL 6 MONTH, NULL, 'Location 2', 'poster2.jpg', 'timetable2.pdf', 15.00, FALSE, (SELECT `id` FROM `Policies` WHERE `title` = 'Event Policy'), (SELECT `id` FROM `Policies` WHERE `title` = 'GDPR Policy')),
    (UUID(), 'Event 3', NOW() + INTERVAL 6 MONTH, NULL, 'Location 3', 'poster3.jpg', 'timetable3.pdf', 20.00, TRUE, (SELECT `id` FROM `Policies` WHERE `title` = 'Event Policy'), (SELECT `id` FROM `Policies` WHERE `title` = 'GDPR Policy')),
    (UUID(), 'Event 4', NOW() + INTERVAL 6 MONTH, NULL, 'Location 4', 'poster4.jpg', 'timetable4.pdf', 0.00, FALSE, (SELECT `id` FROM `Policies` WHERE `title` = 'Event Policy'), (SELECT `id` FROM `Policies` WHERE `title` = 'GDPR Policy'));

SET GLOBAL event_scheduler = ON;

-- Check if the procedure exists before dropping
DROP PROCEDURE IF EXISTS `delete_past_events_proc`;

-- Create procedure to delete past events
DELIMITER //

CREATE PROCEDURE `delete_past_events_proc`()
BEGIN
  DELETE FROM `Events`
  WHERE DATE(`date_from`) < CURDATE();
END //

DELIMITER ;

-- Check if the event exists before dropping
DROP EVENT IF EXISTS `delete_past_events`;

-- Run above procedure daily
DELIMITER //

CREATE EVENT `delete_past_events` ON SCHEDULE EVERY 1 DAY DO
BEGIN
  CALL `delete_past_events_proc`();
END //

DELIMITER ;

-- TEST EVENTS -> Should not be inserted after CALL to delete_past_events
-- Inserting sample events (adjust date_from as needed)
INSERT INTO `Events` (`id`, `title`, `date_from`, `date_to`, `location`, `poster_link`, `timetable_link`, `price`, `policy_id`, `gdpr_id`)
VALUES
  (UUID(), 'Past Event', '2023-01-01 00:00:00', '2023-01-02 00:00:00', 'Location 1', 'poster1.jpg', 'timetable1.pdf', 10.00, (SELECT `id` FROM `Policies` WHERE `title` = 'Event Policy'), (SELECT `id` FROM `Policies` WHERE `title` = 'GDPR Policy')),
  (UUID(), 'Future Event', '2024-01-01 00:00:00', '2024-01-02 00:00:00', 'Location 2', 'poster2.jpg', 'timetable2.pdf', 15.00, (SELECT `id` FROM `Policies` WHERE `title` = 'Event Policy'), (SELECT `id` FROM `Policies` WHERE `title` = 'GDPR Policy'));

-- Manually execute the event to delete past events
CALL `delete_past_events_proc`();