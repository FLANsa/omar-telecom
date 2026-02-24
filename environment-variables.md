# Omar telecom - Environment Variables
# متغيرات البيئة لنظام عمر للاتصالات

# Firebase Configuration
FIREBASE_API_KEY=AIzaSyAjLgTfb2TJuQ5EIyls5v1GNX21LcaZVb4
FIREBASE_AUTH_DOMAIN=omar-telecom-682ac.firebaseapp.com
FIREBASE_PROJECT_ID=omar-telecom-682ac
FIREBASE_STORAGE_BUCKET=omar-telecom-682ac.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=357723312982
FIREBASE_APP_ID=1:357723312982:web:a7fbe2c0e1f55f545ffcf7
FIREBASE_MEASUREMENT_ID=G-FK23TTC0TG

# Application Settings
NODE_ENV=production
APP_NAME=Omar telecom
APP_VERSION=2.0.0
APP_DESCRIPTION=نظام إدارة متجر الجوالات

# Company Information
COMPANY_NAME=عمر للاتصالات
COMPANY_NAME_EN=Omar for Communications
COMPANY_ADDRESS=الرياض، المملكة العربية السعودية
COMPANY_PHONE=0531100725
COMPANY_EMAIL=support@omar-telecom.com

# Database Settings
DATABASE_TYPE=firestore
DATABASE_COLLECTION_PHONES=phones
DATABASE_COLLECTION_ACCESSORIES=accessories
DATABASE_COLLECTION_SALES=sales
DATABASE_COLLECTION_PHONE_TYPES=phone_types

# Security Settings
JWT_SECRET=omar-telecom-secret-key-2025
SESSION_SECRET=omar-telecom-session-secret
ENCRYPTION_KEY=omar-telecom-encryption-key

# VAT Settings (Saudi Arabia)
VAT_RATE=0.15
VAT_RATE_PERCENTAGE=15

# File Upload Settings
MAX_FILE_SIZE=5242880
ALLOWED_FILE_TYPES=jpg,jpeg,png,gif,pdf
UPLOAD_PATH=uploads/

# Email Settings (if needed)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Logging Settings
LOG_LEVEL=info
LOG_FILE=logs/app.log

# Cache Settings
CACHE_TTL=3600
CACHE_MAX_SIZE=100

# Rate Limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX_REQUESTS=100

# Development Settings
DEBUG=false
HOT_RELOAD=false
