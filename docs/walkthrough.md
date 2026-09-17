# Benkyou ERP & LMS - Screenshots, Source Code, Security Features, Third-Party APIs, and Execution Guide

Welcome to the comprehensive technical documentation for the **Benkyou Web ERP & LMS Platform**. This document details the **API Functions, Security Features, Third-Party APIs, and System Features**, accompanied by clear prototype screenshots, image label names, source code component mappings, API specifications, algorithm usage, and a detailed **step-by-step discussion on how each security process works** from front-to-back.

---

## Overview of Core Architecture & Security Infrastructure

Benkyou is engineered with enterprise-grade multi-tenant security protections:

1. **Multi-Factor Authentication (2FA OTP)**: Resend API-powered 6-digit email verification codes protecting SuperAdmin logins.
2. **Account Lockout & Brute-Force Shield**: Automatically locks accounts after 5 failed login attempts and logs suspicious activity.
3. **Fixed-Window Rate Limiting & Proxy IP Detection**: Protects auth endpoints against DDoS and credential stuffing attacks using Cloudflare `CF-Connecting-IP` header inspection.
4. **Multi-Tenant Cryptographic Isolation**: Strict tenant scoping (`TenantID`) enforced via JWT Bearer claims and EF Core expression trees.
5. **Real-Time Audit Logging**: Non-repudiable audit trails (`AuditLogs`) capturing IP addresses, timestamps, user IDs, and system actions.
6. **Third-Party Integrations**: Stripe API (Subscriptions), Cloudinary API (CDN Media Storage), Resend API (Transactional Emails), and OneSignal API (Web Push Notifications).

---

## Table of Contents
1. [Security Infrastructure Features](#1-security-infrastructure-features)
   - [Security Feature 1: SuperAdmin Multi-Factor Authentication (Email 2FA OTP)](#security-feature-1-superadmin-multi-factor-authentication-email-2fa-otp)
   - [Security Feature 2: Account Lockout & Brute-Force Attack Prevention](#security-feature-2-account-lockout--brute-force-attack-prevention)
   - [Security Feature 3: Rate Limiting & DDoS Defense Shield](#security-feature-3-rate-limiting--ddos-defense-shield)
   - [Security Feature 4: Multi-Tenant Data Isolation & Real-Time Audit Log Monitoring](#security-feature-4-multi-tenant-data-isolation--real-time-audit-log-monitoring)
   - [Security Feature 5: CORS Guard & SQL Injection Defense](#security-feature-5-cors-guard--sql-injection-defense)
2. [Academic Operations & Admissions (Operator Module)](#2-academic-operations--admissions-operator-module)
   - [API Feature 1: Batch Student Enrollment](#api-feature-1-batch-student-enrollment)
   - [API Feature 2: Class Section Setup & Management](#api-feature-2-class-section-setup--management)
   - [API Feature 3: Bulk Student Directory Onboarding](#api-feature-3-bulk-student-directory-onboarding)
3. [Curriculum & Grading Operations (Instructor Module)](#3-curriculum--grading-operations-instructor-module)
   - [API Feature 4: Course Curriculum Design & Cloudinary CDN Upload](#api-feature-4-course-curriculum-design--cloudinary-cdn-upload)
   - [API Feature 5: Assessment & Question Composition](#api-feature-5-assessment--question-composition)
   - [API Feature 6: Student Work Review & Essay Grading](#api-feature-6-student-work-review--essay-grading)
4. [Student Learning & Evaluation (Student Module)](#4-student-learning--evaluation-student-module)
   - [API Feature 7: Interactive Course Player & Progress Tracking](#api-feature-7-interactive-course-player--progress-tracking)
   - [API Feature 8: Timed Exam Session & Auto-Evaluation](#api-feature-8-timed-exam-session--auto-evaluation)
5. [Administration & Billing (Admin Module)](#5-administration--billing-admin-module)
   - [API Feature 9: Stripe API Subscription Billing & Checkout](#api-feature-9-stripe-api-subscription-billing--checkout)

---

## 1. Security Infrastructure Features

### Security Feature 1: SuperAdmin Multi-Factor Authentication (Email 2FA OTP)
* **Screen Name:** `SuperAdminLogin.jsx` / `SuperAdminOtpModal.jsx`
* **Label Name:** **SuperAdmin Multi-Factor Authentication (Email 2FA OTP)**
* **Screenshot:**
  ![SuperAdmin Multi-Factor Authentication (Email 2FA OTP)](./screenshots/superadmin_otp_auth.png)
* **Source Code Files:**
  - **Frontend UI:** [Login.jsx](file:///c:/Users/Charlize%20Jane%20Inday/source/repos/Benkyou/frontend/benkyou-ui/src/pages/SuperAdmin/Login.jsx)
  - **Backend Controller:** [AuthControllers.cs (SuperAdminLogin & SuperAdminVerifyOtp)](file:///c:/Users/Charlize%20Jane%20Inday/source/repos/Benkyou/Benkyou.API/Controllers/AuthControllers.cs)
  - **OTP Service:** [SuperAdminOtpService.cs](file:///c:/Users/Charlize%20Jane%20Inday/source/repos/Benkyou/Benkyou.Core/Services/SuperAdminOtpService.cs)
* **APIs Used:**
  - `POST /api/auth/superadmin/login` — Validates email/password credentials and generates 5-minute temporary session token.
  - `POST /api/auth/superadmin/verify-otp` — Validates 6-digit OTP code and issues full SuperAdmin JWT bearer token.
  - **Resend Email REST API:** `POST https://api.resend.com/emails` — Delivers 6-digit verification code to admin inbox.
* **Algorithms / Logic Used:**
  - **Cryptographic Random OTP Generator:** `RandomNumberGenerator.GetInt32(100000, 999999)` generating un-guessable 6-digit numbers.
  - **Short-Lived Temp JWT Token Algorithm:** Cryptographically signed token (`expiryMinutes: 5`) restricting API access strictly to the OTP verification step.

#### Process: How It Works Step-by-Step
1. **Primary Authentication:** SuperAdmin enters email and password on the login portal.
2. **Credential Verification & Temp Token Issue:** `SuperAdminLogin` verifies BCrypt password hash. If valid, it generates a 6-digit OTP code, saves it to SQL Server (`Expiry = UtcNow.AddMinutes(5)`), and returns a temporary short-lived JWT token (`tempToken`).
3. **Resend Email API Dispatch:** `SuperAdminOtpService` calls Resend API (`POST https://api.resend.com/emails`) to dispatch the 6-digit verification code to the administrator's email.
4. **OTP Modal Prompt:** The UI displays an overlay modal requesting the 6-digit verification code.
5. **OTP Verification & Full JWT Issuance:** Entering the code sends `POST /api/auth/superadmin/verify-otp` carrying `{ tempToken, code }`. `SuperAdminVerifyOtp` validates the temp token and code. If correct, it returns a full SuperAdmin JWT bearer token with claims (`role: SuperAdmin`, `isSuperAdmin: true`).

---

### Security Feature 2: Account Lockout & Brute-Force Attack Prevention
* **Screen Name:** `Login.jsx` Lockout Alert
* **Label Name:** **Account Lockout & Brute-Force Attack Prevention**
* **Screenshot:**
  ![Account Lockout & Brute-Force Attack Prevention](./screenshots/account_lockout_alert.png)
* **Source Code Files:**
  - **Frontend UI:** [Login.jsx](file:///c:/Users/Charlize%20Jane%20Inday/source/repos/Benkyou/frontend/benkyou-ui/src/pages/Auth/Login.jsx)
  - **Backend Controller:** [AuthControllers.cs (Login action)](file:///c:/Users/Charlize%20Jane%20Inday/source/repos/Benkyou/Benkyou.API/Controllers/AuthControllers.cs)
  - **Lockout Service:** [AccountLockoutService.cs](file:///c:/Users/Charlize%20Jane%20Inday/source/repos/Benkyou/Benkyou.Core/Services/AccountLockoutService.cs)
* **APIs Used:**
  - `POST /api/auth/login` — Authentication endpoint with built-in brute-force protection logic.
* **Algorithms / Logic Used:**
  - **Exponential Counter Lockout Algorithm:** Increments `FailedLoginAttempts`. When attempts reach `5`, sets `LockoutEnd = UtcNow.AddMinutes(15)`.
  - **Audit Threat Logger:** Logs `Suspicious Activity: Account Locked Out` to `AuditLogs` table with remote IP address.

#### Process: How It Works Step-by-Step
1. **Login Attempt:** User submits credentials to `/api/auth/login`.
2. **Lockout Check:** `AccountLockoutService.IsLockedOutAsync()` checks if `LockoutEnd > UtcNow`. If locked, it immediately returns `HTTP 403 Forbidden` with remaining lockout duration without executing password checks.
3. **Failed Attempt Increment:** If password verification fails, `RecordFailedAttemptAsync()` increments `FailedLoginAttempts`. It calculates `attemptsRemaining = 5 - FailedLoginAttempts`.
4. **Lockout Trigger:** On the 5th consecutive failure, `LockoutEnd` is set to 15 minutes in the future, `AuditLogService` writes a security threat log, and `HTTP 403` is returned: `"Account is locked due to too many failed attempts. Try again in 15 minutes."`
5. **Successful Reset:** On valid login, `ResetFailedAttemptsAsync()` resets `FailedLoginAttempts` to 0.

---

### Security Feature 3: Rate Limiting & DDoS Defense Shield
* **Screen Name:** HTTP 429 Rate Limit Response Handler
* **Label Name:** **Rate Limiting & DDoS Defense Shield**
* **Screenshot:**
  ![Rate Limiting & DDoS Defense Shield](./screenshots/rate_limiting_shield.png)
* **Source Code Files:**
  - **Middleware Config:** [Program.cs (AddRateLimiter configuration)](file:///c:/Users/Charlize%20Jane%20Inday/source/repos/Benkyou/Benkyou.API/Program.cs)
  - **API Client:** [client.js](file:///c:/Users/Charlize%20Jane%20Inday/source/repos/Benkyou/frontend/benkyou-ui/src/api/client.js)
* **APIs Used:**
  - ASP.NET Core `AddRateLimiter` middleware enforcing policy limits:
    - `/api/auth/login`: 5 requests per 15 minutes per partition key.
    - `/api/auth/verify-otp`: 5 requests per 10 minutes.
    - `/api/auth/register-org`: 3 requests per 30 minutes.
* **Algorithms / Logic Used:**
  - **Cloudflare Header IP Extraction Algorithm:** Inspects `CF-Connecting-IP` -> `X-Forwarded-For` -> `X-Real-IP` -> `RemoteIpAddress` to accurately identify client IP behind reverse proxies/CDNs.
  - **Fixed Window Rate Limiting Algorithm:** `FixedWindowRateLimiterOptions` partitioning request queues.

#### Process: How It Works Step-by-Step
1. **Request Interception:** Incoming HTTP request passes through `app.UseRateLimiter()`.
2. **IP / Body Partitioning:** Middleware extracts client IP via Cloudflare headers or parses request body identifier (email/token) as partition key.
3. **Quota Evaluation:** Evaluates partition window counter. If within limit, request proceeds to controllers.
4. **Rate Limit Rejection:** If requests exceed limit, middleware intercepts execution, attaches CORS headers (`Access-Control-Allow-Origin`), and returns `HTTP 429 Too Many Requests` with JSON `{ message: "Too many login attempts. Please try again in 15 minutes." }`.
5. **Client Notification:** Frontend `client.js` extracts status 429 and displays a clean warning notification.

---

### Security Feature 4: Multi-Tenant Data Isolation & Real-Time Audit Log Monitoring
* **Screen Name:** `AuditLogs.jsx`
* **Label Name:** **Multi-Tenant Data Isolation & Real-Time Audit Log Monitoring**
* **Screenshot:**
  ![Multi-Tenant Data Isolation & Real-Time Audit Log Monitoring](./screenshots/audit_logs_monitor.png)
* **Source Code Files:**
  - **Frontend UI:** [AuditLogs.jsx](file:///c:/Users/Charlize%20Jane%20Inday/source/repos/Benkyou/frontend/benkyou-ui/src/pages/SuperAdmin/AuditLogs.jsx)
  - **Base Controller:** [BaseController.cs](file:///c:/Users/Charlize%20Jane%20Inday/source/repos/Benkyou/Benkyou.API/Controllers/BaseController.cs)
  - **Audit Log Service:** [AuditLogService.cs](file:///c:/Users/Charlize%20Jane%20Inday/source/repos/Benkyou/Benkyou.Core/Services/AuditLogService.cs)
* **APIs Used:**
  - `GET /api/audit-logs` — Retrieves system audit trail logs.
  - `[Authorize(Roles = "...")]` — Declarative role authorization attributes across all controllers.
* **Algorithms / Logic Used:**
  - **JWT Claim Tenant Isolation Algorithm:** `BaseController.TenantId` property extracts `tenantId` claim from cryptographically verified JWT token. All LINQ queries auto-filter `Where(x => x.TenantID == TenantId)`.
  - **Non-Repudiable Audit Trail Logger:** Asynchronously writes entity changes, user IDs, tenant IDs, IP addresses, and timestamps to `AuditLogs` table.

#### Process: How It Works Step-by-Step
1. **JWT Verification:** Every request header `Authorization: Bearer <token>` is validated using HMAC-SHA256 signature key.
2. **Tenant Scoping:** `BaseController` extracts `TenantId`. Controllers force `c.TenantID == TenantId` on all database operations, making cross-tenant data leaks impossible.
3. **Audit Event Generation:** When administrative actions occur (e.g. user creation, section updates, role changes), `LogAction()` captures remote IP, timestamp, user ID, and action description.
4. **Audit Dashboard Render:** SuperAdmins access `/superadmin/audit-logs` (`GET /api/audit-logs`) to monitor security events, suspicious login attempts, and administrative transactions in real-time.

---

### Security Feature 5: CORS Guard & SQL Injection Defense
* **Screen Name:** System Architecture Security
* **Label Name:** **CORS Header Guard & Database Parameterization Shield**
* **Screenshot:**
  ![CORS Header Guard & Database Parameterization Shield](./screenshots/security_cors_guard.png)
* **Source Code Files:**
  - **Pipeline Config:** [Program.cs](file:///c:/Users/Charlize%20Jane%20Inday/source/repos/Benkyou/Benkyou.API/Program.cs)
  - **DbContext:** [BenkyouDbContext.cs](file:///c:/Users/Charlize%20Jane%20Inday/source/repos/Benkyou/Benkyou.Data/BenkyouDbContext.cs)
* **APIs Used:**
  - Entity Framework Core Expression Tree API.
  - ASP.NET Core `UseCors` middleware policy.
* **Algorithms / Logic Used:**
  - **Parameterized Query Generation:** Converts LINQ queries into SQL parameterized commands `@p0, @p1`, completely neutralizing SQL injection attacks.
  - **Strict CORS Origin Whitelist:** Validates origin header against approved domains (`https://benkyoulearn.runasp.net`, `https://benkyou.runasp.net`).

---

## 2. Academic Operations & Admissions (Operator Module)

### API Feature 1: Batch Student Enrollment
* **Screen Name:** `BatchEnroll.jsx`
* **Label Name:** **Operator Batch Enrollment Panel**
* **Screenshot:**
  ![Operator Batch Enrollment Panel](./screenshots/operator_batch_enrollment.png)
* **Source Code Files:**
  - **Frontend UI:** [BatchEnroll.jsx](file:///c:/Users/Charlize%20Jane%20Inday/source/repos/Benkyou/frontend/benkyou-ui/src/pages/Operator/BatchEnroll.jsx)
  - **Backend Controller:** [EnrollmentController.cs](file:///c:/Users/Charlize%20Jane%20Inday/source/repos/Benkyou/Benkyou.API/Controllers/EnrollmentController.cs)
* **APIs Used:**
  - `POST /api/enrollment/batch` — Bulk registers student email lists.
  - `GET /api/courses` — Retrieves active course catalog.
  - `GET /api/class-sections/course/{courseId}` — Fetches section list.
  - **OneSignal Push Notification API:** `POST https://onesignal.com/api/v1/notifications` — Dispatches course access push notifications.

---

### API Feature 2: Class Section Setup & Management
* **Screen Name:** `ClassSections.jsx`
* **Label Name:** **Operator Class Sections Management**
* **Screenshot:**
  ![Operator Class Sections Management](./screenshots/operator_class_sections.png)
* **Source Code Files:**
  - **Frontend UI:** [ClassSections.jsx](file:///c:/Users/Charlize%20Jane%20Inday/source/repos/Benkyou/frontend/benkyou-ui/src/pages/Operator/ClassSections.jsx)
  - **Backend Controller:** [ClassSectionsController.cs](file:///c:/Users/Charlize%20Jane%20Inday/source/repos/Benkyou/Benkyou.API/Controllers/ClassSectionsController.cs)
* **APIs Used:**
  - `GET /api/class-sections/course/{courseId}` — Retrieves class sections.
  - `POST /api/class-sections` — Creates a section.

---

### API Feature 3: Bulk Student Directory Onboarding
* **Screen Name:** `ImportStudents.jsx`
* **Label Name:** **Operator Student Roster & CSV Import**
* **Screenshot:**
  ![Operator Student Roster & CSV Import](./screenshots/operator_student_import.png)
* **Source Code Files:**
  - **Frontend UI:** [ImportStudents.jsx](file:///c:/Users/Charlize%20Jane%20Inday/source/repos/Benkyou/frontend/benkyou-ui/src/pages/Operator/ImportStudents.jsx)
  - **Backend Controller:** [OperatorController.cs](file:///c:/Users/Charlize%20Jane%20Inday/source/repos/Benkyou/Benkyou.API/Controllers/OperatorController.cs)
* **APIs Used:**
  - `POST /api/operator/students/import` — Processes binary spreadsheet uploads.
  - **Resend Email API:** `POST https://api.resend.com/emails` — Sends welcome email notifications.

---

## 3. Curriculum & Grading Operations (Instructor Module)

### API Feature 4: Course Curriculum Design & Cloudinary CDN Upload
* **Screen Name:** `CourseEditor.jsx`
* **Label Name:** **Instructor Course Curriculum Editor**
* **Screenshot:**
  ![Instructor Course Curriculum Editor](./screenshots/instructor_course_editor.png)
* **Source Code Files:**
  - **Frontend UI:** [CourseEditor.jsx](file:///c:/Users/Charlize%20Jane%20Inday/source/repos/Benkyou/frontend/benkyou-ui/src/pages/Instructor/CourseEditor.jsx)
  - **Cloudinary Service:** [CloudinaryService.cs](file:///c:/Users/Charlize%20Jane%20Inday/source/repos/Benkyou/Benkyou.Core/Services/CloudinaryService.cs)
* **APIs Used:**
  - **Cloudinary CDN API:** `POST https://api.cloudinary.com/v1_1/{cloud_name}/upload` — Uploads lecture videos and PDFs.

---

### API Feature 5: Assessment & Question Composition
* **Screen Name:** `AssessmentBuilder.jsx`
* **Label Name:** **Instructor Assessment & Question Builder**
* **Screenshot:**
  ![Instructor Assessment & Question Builder](./screenshots/instructor_assessment_builder.png)
* **Source Code Files:**
  - **Frontend UI:** [AssessmentBuilder.jsx](file:///c:/Users/Charlize%20Jane%20Inday/source/repos/Benkyou/frontend/benkyou-ui/src/pages/Instructor/AssessmentBuilder.jsx)
  - **Core Service:** [AssessmentBuilderService.cs](file:///c:/Users/Charlize%20Jane%20Inday/source/repos/Benkyou/Benkyou.Core/Services/AssessmentBuilderService.cs)

---

### API Feature 6: Student Work Review & Essay Grading
* **Screen Name:** `SubmissionReview.jsx`
* **Label Name:** **Instructor Submission Review & Grading Panel**
* **Screenshot:**
  ![Instructor Submission Review & Grading Panel](./screenshots/instructor_submission_review.png)
* **Source Code Files:**
  - **Frontend UI:** [SubmissionReview.jsx](file:///c:/Users/Charlize%20Jane%20Inday/source/repos/Benkyou/frontend/benkyou-ui/src/pages/Instructor/SubmissionReview.jsx)
* **APIs Used:**
  - `PUT /api/attempts/answers/{answerId}/grade` — Submits essay score and feedback.
  - **OneSignal Push Notification API:** Sends push notification when grade is published.

---

## 4. Student Learning & Evaluation (Student Module)

### API Feature 7: Interactive Course Player & Progress Tracking
* **Screen Name:** `LearningView.jsx`
* **Label Name:** **Student Lecture Player & Course Index**
* **Screenshot:**
  ![Student Lecture Player & Course Index](./screenshots/student_learning_player.png)
* **Source Code Files:**
  - **Frontend UI:** [LearningView.jsx](file:///c:/Users/Charlize%20Jane%20Inday/source/repos/Benkyou/frontend/benkyou-ui/src/pages/Student/LearningView.jsx)

---

### API Feature 8: Timed Exam Session & Auto-Evaluation
* **Screen Name:** `QuizPlayer.jsx`
* **Label Name:** **Student Exam Player & Assessment Interface**
* **Screenshot:**
  ![Student Exam Player & Assessment Interface](./screenshots/student_quiz_player.png)
* **Source Code Files:**
  - **Frontend UI:** [QuizPlayer.jsx](file:///c:/Users/Charlize%20Jane%20Inday/source/repos/Benkyou/frontend/benkyou-ui/src/pages/Student/QuizPlayer.jsx)

---

## 5. Administration & Billing (Admin Module)

### API Feature 9: Stripe API Subscription Billing & Checkout
* **Screen Name:** `MockPayment.jsx`
* **Label Name:** **Admin Billing Mock Checkout**
* **Screenshot:**
  ![Admin Billing Mock Checkout](./screenshots/admin_mock_payment.png)
* **Source Code Files:**
  - **Frontend UI:** [MockPayment.jsx](file:///c:/Users/Charlize%20Jane%20Inday/source/repos/Benkyou/frontend/benkyou-ui/src/pages/Admin/MockPayment.jsx)
  - **Backend Services:** [StripeService.cs](file:///c:/Users/Charlize%20Jane%20Inday/source/repos/Benkyou/Benkyou.Core/Services/StripeService.cs)
* **APIs Used:**
  - **Stripe Billing API (`Stripe.net` SDK):**
    - `POST https://api.stripe.com/v1/customers`
    - `POST https://api.stripe.com/v1/checkout/sessions`
    - `POST /api/stripe/webhook` (HMAC-SHA256 signature verification)

---

> [!NOTE]
> All prototype screens depicted here follow modern glassmorphic design guidelines with enterprise multi-tenant security protections.
