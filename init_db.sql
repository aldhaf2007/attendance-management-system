-- ===============================================================
-- College Attendance Tracker - Database Schema & Initialization
-- Compatible with MySQL 8.0+ / MariaDB 10.5+
-- ===============================================================

CREATE DATABASE IF NOT EXISTS attendance_db 
    CHARACTER SET utf8mb4 
    COLLATE utf8mb4_unicode_ci;

USE attendance_db;

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Departments Table
CREATE TABLE IF NOT EXISTS departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    INDEX idx_departments_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Staff Departments (Multi-Department Cross-Teaching Table)
CREATE TABLE IF NOT EXISTS staff_departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    department_1_id INT NULL,
    department_2_id INT NULL,
    department_3_id INT NULL,
    department_4_id INT NULL,
    department_5_id INT NULL,
    department_6_id INT NULL,
    department_7_id INT NULL,
    department_8_id INT NULL,
    department_9_id INT NULL,
    FOREIGN KEY (department_1_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (department_2_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (department_3_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (department_4_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (department_5_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (department_6_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (department_7_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (department_8_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (department_9_id) REFERENCES departments(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Users Table (Authentication & 3-Level RBAC)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NULL,
    pin_hash VARCHAR(255) NULL,
    role ENUM('Admin', 'Department', 'Staff') NOT NULL DEFAULT 'Staff',
    department_id INT NULL,
    INDEX idx_users_username (username),
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Staffs Table (Faculty Profiles)
CREATE TABLE IF NOT EXISTS staffs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    initials VARCHAR(10) NOT NULL UNIQUE,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NULL,
    pin_hash VARCHAR(255) NULL,
    department_id INT NULL,
    user_id INT NULL,
    INDEX idx_staffs_initials (initials),
    INDEX idx_staffs_username (username),
    FOREIGN KEY (department_id) REFERENCES staff_departments(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Students Table (Enrolled Academic Cohorts: Years 1, 2, 3)
CREATE TABLE IF NOT EXISTS students (
    roll_no VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    year INT NOT NULL,
    department_id INT NOT NULL,
    INDEX idx_students_roll (roll_no),
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Attendance Records Table (Granular Period Logs)
CREATE TABLE IF NOT EXISTS attendance_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    date DATE NOT NULL,
    hour_number INT NOT NULL,
    roll_no VARCHAR(50) NOT NULL,
    status ENUM('Present', 'Absent', 'OD') NOT NULL,
    staff_id INT NOT NULL,
    INDEX idx_attendance_date (date),
    INDEX idx_attendance_roll (roll_no),
    UNIQUE KEY uq_attendance_date_hour_roll (date, hour_number, roll_no),
    FOREIGN KEY (roll_no) REFERENCES students(roll_no) ON DELETE CASCADE,
    FOREIGN KEY (staff_id) REFERENCES staffs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Calendar Overrides Table (Holidays & Half-Days)
CREATE TABLE IF NOT EXISTS calendar_overrides (
    date DATE PRIMARY KEY,
    day_type ENUM('full_day', 'half_day', 'holiday') NOT NULL DEFAULT 'full_day',
    active_periods JSON NOT NULL,
    description VARCHAR(255) NULL,
    INDEX idx_calendar_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- Seed only the default root System Administrator account
-- Username: admin | Password: admin123
INSERT INTO users (username, password_hash, pin_hash, role, department_id)
SELECT 'admin', '$2b$12$PJXKmeOAALJRI787uUk4aeZ5e2pf4AAr7wVTNjG4oUx4A/s7sueCa', NULL, 'Admin', NULL
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin');
