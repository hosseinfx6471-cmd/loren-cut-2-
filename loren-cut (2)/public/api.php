<?php
/**
 * Hardened Security & Production REST API for Loren Cut
 * Fully compatible with cPanel / DirectAdmin / Apache / LiteSpeed / Nginx / Express
 *
 * Source of Truth: app_data.json
 * Admin SMS Target: 09913272265 (Melipayamak SendSimpleSMS2)
 * Customer SMS: Disabled per salon policy
 */

// Buffer all outputs to prevent any PHP notices or BOM from corrupting JSON responses
ob_start();

// Error handling: prevent internal path disclosure and fatal output
error_reporting(0);
ini_set('display_errors', '0');

// Strict Security Headers & Dynamic Restrictive CORS
$httpOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowedOrigin = null;

if (!empty($httpOrigin)) {
    $parsedOrigin = parse_url($httpOrigin);
    $originHost = strtolower($parsedOrigin['host'] ?? '');
    $currentHost = strtolower($_SERVER['HTTP_HOST'] ?? '');
    $cleanCurrentHost = preg_replace('/:\d+$/', '', $currentHost);

    $normOrigin = preg_replace('/^www\./', '', $originHost);
    $normCurrent = preg_replace('/^www\./', '', $cleanCurrentHost);

    if (
        $originHost === $cleanCurrentHost ||
        $normOrigin === $normCurrent ||
        $normOrigin === 'hsandari.ir' ||
        $normOrigin === 'lorencut.ir' ||
        $originHost === 'localhost' ||
        $originHost === '127.0.0.1' ||
        preg_match('/\.run\.app$/i', $originHost) ||
        preg_match('/\.google\.com$/i', $originHost) ||
        preg_match('/\.googleusercontent\.com$/i', $originHost)
    ) {
        $allowedOrigin = $httpOrigin;
    }
}

if ($allowedOrigin) {
    header("Access-Control-Allow-Origin: {$allowedOrigin}");
    header('Vary: Origin');
    header('Access-Control-Allow-Credentials: true');
} else {
    header('Access-Control-Allow-Origin: *');
}

header('Access-Control-Allow-Methods: GET, POST, PATCH, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Cache-Control, Pragma, X-Admin-Token, Accept, Origin');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0, post-check=0, pre-check=0');
header('Pragma: no-cache');
header('Expires: 0');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('X-XSS-Protection: 1; mode=block');
header('Referrer-Policy: strict-origin-when-cross-origin');

// HSTS (HTTP Strict Transport Security) for HTTPS
$isHttps = (
    (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ||
    (isset($_SERVER['SERVER_PORT']) && (int)$_SERVER['SERVER_PORT'] === 443) ||
    (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https')
);
if ($isHttps) {
    header('Strict-Transport-Security: max-age=31536000; includeSubDomains; preload');
}

// Content Security Policy
header("Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://fonts.googleapis.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https://images.unsplash.com https://*.unsplash.com https://lorencut.ir https://*.lorencut.ir https://hsandari.ir https://*.hsandari.ir; connect-src 'self' https://api.payamak-panel.com https://fonts.googleapis.com https://fonts.gstatic.com https://hsandari.ir https://*.hsandari.ir https://lorencut.ir; frame-ancestors 'self' https://*.google.com https://*.googleusercontent.com https://*.run.app;");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    if (ob_get_length()) ob_clean();
    exit();
}

// Helper to safely output JSON and terminate
function sendJsonPHP($data, $statusCode = 200) {
    http_response_code($statusCode);
    if (ob_get_length()) ob_clean();
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit();
}

// Load .env environment file if available in root or current directory
function loadEnvFilePHP() {
    $searchDirs = [__DIR__, dirname(__DIR__), dirname(dirname(__DIR__))];
    foreach ($searchDirs as $dir) {
        $envFile = $dir . '/.env';
        if (file_exists($envFile) && is_readable($envFile)) {
            $lines = @file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            if ($lines) {
                foreach ($lines as $line) {
                    $line = trim($line);
                    if ($line === '' || strpos($line, '#') === 0) continue;
                    if (strpos($line, '=') !== false) {
                        list($k, $v) = explode('=', $line, 2);
                        $k = trim($k);
                        $v = trim($v, " \t\n\r\0\x0B\"'");
                        if (!empty($k)) {
                            putenv("{$k}={$v}");
                            $_ENV[$k] = $v;
                            $_SERVER[$k] = $v;
                        }
                    }
                }
            }
            break;
        }
    }
}
loadEnvFilePHP();

function getFirstNonEmptyPHP(...$candidates) {
    foreach ($candidates as $c) {
        if ($c !== null && $c !== false) {
            $s = trim((string)$c);
            if ($s !== '') {
                return $s;
            }
        }
    }
    return '';
}

// SMS Audit Logger
function logSmsAuditPHP($action, $phone, $status, $info = '', $code = '') {
    $logFile = sys_get_temp_dir() . '/loren_cut_sms.log';
    $time = date('Y-m-d H:i:s');
    $sanitized = preg_replace('/(password|username|key|pass)=[^&\s]+/i', '$1=***', $info);
    $entry = "[{$time}] [{$action}] Phone: {$phone} | Status: {$status} | Code: {$code} | Info: {$sanitized}\n";
    @file_put_contents($logFile, $entry, FILE_APPEND | LOCK_EX);
    error_log("[LorenCut SMS] {$entry}");
}

// ==========================================
// 1. DATABASE FILE RESOLUTION & INIT
// ==========================================
$DATA_FILE = __DIR__ . '/app_data.json';
if (!file_exists($DATA_FILE) && file_exists(__DIR__ . '/../app_data.json')) {
    $DATA_FILE = __DIR__ . '/../app_data.json';
}

// Derive Persistent HMAC Secret across all PHP worker processes
function getPersistentAuthSecretPHP() {
    $secret = getenv('AUTH_SECRET') ?: ($_ENV['AUTH_SECRET'] ?? '');
    if (!empty($secret)) return $secret;

    $secretFile = sys_get_temp_dir() . '/loren_cut_secret.key';
    if (file_exists($secretFile)) {
        $secret = trim((string)@file_get_contents($secretFile));
    }
    if (empty($secret)) {
        $secret = hash('sha256', 'loren_cut_auth_permanent_master_salt_' . __DIR__);
        @file_put_contents($secretFile, $secret);
    }
    return $secret;
}

$AUTH_SECRET = getPersistentAuthSecretPHP();

// Default initial config with bcrypt hash for 'admin123'
$defaultData = [
    'siteConfig' => [
        'brandName' => 'Loren Cut',
        'cardNumber' => '6219861929212669',
        'cardHolder' => 'محمدمهدی سبزوار',
        'bankName' => 'بانک ملت',
        'telegramUsername' => '@Mohamadsabzevar',
        'telegramUrl' => 'https://t.me/Mohamadsabzevar',
        'instagramUrl' => 'https://www.instagram.com/lorencut_?igsh=MTU3ZXZ5cWtodTFqOQ==',
        'whatsappUrl' => 'https://wa.me/989167209686',
        'googleMapsUrl' => 'https://maps.app.goo.gl/treLYmP7oPh6RE468?g_st=ic',
        'adminUsername' => 'admin',
        'adminPasswordHash' => '$2b$10$GyzFGUBTn.Q/KegEwSOFFe43uFtnxekMUOt3JlanGpcs1YKGQTwPK', // bcrypt for admin123
        'customTimeSlots' => [
            '11:00', '11:45', '12:30', '13:15', '14:00', '14:45', '15:30', '16:15', '17:00', '17:45', '18:30', '19:15'
        ],
        'disabledTimeSlots' => [],
        'depositAmount' => '۷۰۰,۰۰۰ تومان',
        'adminPhoneNumber' => '09913272265',
        'smsUsername' => '',
        'smsPassword' => '',
        'smsApiKey' => '',
        'smsSenderNumber' => '',
        'smsConfirmTemplate' => "سلام {نام} عزیز 💈\nنوبت شما در پیرایشگاه Loren Cut ثبت شد.\n📅 تاریخ: {تاریخ}\n⏰ ساعت: {ساعت}\n✂️ خدمت: {خدمت}\n🔑 کد پیگیری: {کد}\nمنتظر دیدارتان هستیم!",
        'smsReminderTemplate' => "سلام {نام} عزیز 💈\nیادآوری نوبت شما در سالن Loren Cut:\n📅 تاریخ: {تاریخ} - ساعت {ساعت}\nلطفاً ۵ دقیقه قبل از موعد در سالن حضور داشته باشید."
    ],
    'services' => [
        [
            'id' => 's1',
            'title' => 'اصلاح سر',
            'description' => 'اصلاح و کوتاهی تخصصی موی سر، فید و استایل متناسب با آناتومی چهره به همراه شستشو',
            'duration' => '۴۵ دقیقه',
            'price' => '۱,۵۰۰,۰۰۰ تومان',
            'popular' => true
        ]
    ],
    'contentItems' => [],
    'appointments' => [],
    'customers' => []
];

// Helper Functions
function normalizePhonePHP($rawPhone) {
    if (empty($rawPhone)) return '';
    $persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    $arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    $cleaned = trim((string)$rawPhone);
    for ($i = 0; $i < 10; $i++) {
        $cleaned = str_replace($persianDigits[$i], (string)$i, $cleaned);
        $cleaned = str_replace($arabicDigits[$i], (string)$i, $cleaned);
    }
    $cleaned = preg_replace('/\D/', '', $cleaned);
    if (strpos($cleaned, '989') === 0 && strlen($cleaned) === 12) {
        $cleaned = '0' . substr($cleaned, 2);
    } elseif (strpos($cleaned, '00989') === 0 && strlen($cleaned) === 14) {
        $cleaned = '0' . substr($cleaned, 4);
    } elseif (strpos($cleaned, '9') === 0 && strlen($cleaned) === 10) {
        $cleaned = '0' . $cleaned;
    }
    return $cleaned;
}

function sanitizeTextPHP($str, $maxLen = 200) {
    if ($str === null || $str === '') return '';
    $cleaned = strip_tags(trim((string)$str));
    return mb_substr($cleaned, 0, $maxLen, 'UTF-8');
}

// Token Generation & Verification
function generateAdminTokenPHP($username, $secret) {
    $expiresAt = time() + (24 * 3600); // 24 hours validity
    $payload = json_encode(['u' => $username, 'exp' => $expiresAt]);
    $signature = hash_hmac('sha256', $payload, $secret);
    return base64_encode($payload . '.' . $signature);
}

function verifyAdminTokenPHP($secret) {
    $authHeader = '';
    if (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
    } elseif (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $authHeader = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    } elseif (!empty($_SERVER['HTTP_X_ADMIN_TOKEN'])) {
        $authHeader = 'Bearer ' . $_SERVER['HTTP_X_ADMIN_TOKEN'];
    } elseif (!empty($_SERVER['REDIRECT_HTTP_X_ADMIN_TOKEN'])) {
        $authHeader = 'Bearer ' . $_SERVER['REDIRECT_HTTP_X_ADMIN_TOKEN'];
    } elseif (function_exists('getallheaders')) {
        $headers = getallheaders();
        if (!empty($headers['Authorization'])) {
            $authHeader = $headers['Authorization'];
        } elseif (!empty($headers['authorization'])) {
            $authHeader = $headers['authorization'];
        } elseif (!empty($headers['X-Admin-Token'])) {
            $authHeader = 'Bearer ' . $headers['X-Admin-Token'];
        } elseif (!empty($headers['x-admin-token'])) {
            $authHeader = 'Bearer ' . $headers['x-admin-token'];
        }
    } elseif (function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        if (!empty($headers['Authorization'])) {
            $authHeader = $headers['Authorization'];
        } elseif (!empty($headers['authorization'])) {
            $authHeader = $headers['authorization'];
        } elseif (!empty($headers['X-Admin-Token'])) {
            $authHeader = 'Bearer ' . $headers['X-Admin-Token'];
        } elseif (!empty($headers['x-admin-token'])) {
            $authHeader = 'Bearer ' . $headers['x-admin-token'];
        }
    }

    if (empty($authHeader) && !empty($_GET['admin_token'])) {
        $authHeader = 'Bearer ' . $_GET['admin_token'];
    }
    if (empty($authHeader) && !empty($_POST['admin_token'])) {
        $authHeader = 'Bearer ' . $_POST['admin_token'];
    }

    if (empty($authHeader) || !preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
        return false;
    }

    $rawToken = trim($matches[1]);
    $decoded = base64_decode($rawToken, true);
    if (!$decoded || strpos($decoded, '.') === false) {
        return false;
    }

    list($payloadJson, $signature) = explode('.', $decoded, 2);
    $expectedSig = hash_hmac('sha256', $payloadJson, $secret);

    if (!hash_equals($expectedSig, $signature)) {
        return false;
    }

    $payload = json_decode($payloadJson, true);
    if (!$payload || !isset($payload['exp']) || $payload['exp'] < time()) {
        return false;
    }

    return true;
}

// ==========================================
// Melipayamak Server-Side SMS Service (SendSimpleSMS2)
// ==========================================
function sendMelipayamakSMS_PHP($toPhone, $messageText, $siteConfig = []) {
    if (empty($toPhone) || empty($messageText)) {
        logSmsAuditPHP('SEND_SMS', (string)$toPhone, 'FAILED', 'شماره یا متن پیام خالی است.');
        return ['success' => false, 'error' => 'شماره یا متن پیام خالی است.'];
    }
    try {
        $provider = strtolower($siteConfig['smsProvider'] ?? 'melipayamak');

        $username = getFirstNonEmptyPHP(
            $siteConfig['smsUsername'] ?? null,
            $siteConfig['smsApiKey'] ?? null,
            getenv('MELIPAYAMAK_USERNAME'),
            getenv('SMS_USERNAME'),
            $_ENV['MELIPAYAMAK_USERNAME'] ?? null,
            $_ENV['SMS_USERNAME'] ?? null,
            $_SERVER['MELIPAYAMAK_USERNAME'] ?? null,
            $_SERVER['SMS_USERNAME'] ?? null
        );

        $password = getFirstNonEmptyPHP(
            $siteConfig['smsPassword'] ?? null,
            $siteConfig['smsApiKey'] ?? null,
            getenv('MELIPAYAMAK_PASSWORD'),
            getenv('SMS_PASSWORD'),
            $_ENV['MELIPAYAMAK_PASSWORD'] ?? null,
            $_ENV['SMS_PASSWORD'] ?? null,
            $_SERVER['MELIPAYAMAK_PASSWORD'] ?? null,
            $_SERVER['SMS_PASSWORD'] ?? null
        );

        $apiKey = getFirstNonEmptyPHP(
            $siteConfig['smsApiKey'] ?? null,
            $siteConfig['smsPassword'] ?? null,
            $siteConfig['smsUsername'] ?? null,
            getenv('SMS_API_KEY'),
            $_ENV['SMS_API_KEY'] ?? null,
            $_SERVER['SMS_API_KEY'] ?? null
        );

        $from = getFirstNonEmptyPHP(
            $siteConfig['smsSenderNumber'] ?? null,
            getenv('MELIPAYAMAK_FROM'),
            getenv('SMS_SENDER'),
            $_ENV['MELIPAYAMAK_FROM'] ?? null,
            $_ENV['SMS_SENDER'] ?? null,
            $_SERVER['MELIPAYAMAK_FROM'] ?? null,
            $_SERVER['SMS_SENDER'] ?? null,
            '50004001'
        );

        $cleanPhone = preg_replace('/[^0-9]/', '', (string)$toPhone);
        if (strpos($cleanPhone, '0') === 0) {
            $formattedTo = '98' . substr($cleanPhone, 1);
            $localPhone = $cleanPhone;
        } elseif (strpos($cleanPhone, '98') === 0) {
            $formattedTo = $cleanPhone;
            $localPhone = '0' . substr($cleanPhone, 2);
        } else {
            $formattedTo = '98' . $cleanPhone;
            $localPhone = '0' . $cleanPhone;
        }

        // 1. IPPanel / FarazSMS Provider
        if ($provider === 'ippanel' || $provider === 'farazsms') {
            $ippanelKey = $apiKey ?: $username;
            if (empty($ippanelKey) && (empty($username) || empty($password))) {
                $err = 'اطلاعات سامانه فراز اس‌ام‌اس (کلید API یا نام کاربری و رمز) ثبت نشده است.';
                logSmsAuditPHP('SEND_SMS', $formattedTo, 'CONFIG_MISSING', $err);
                return ['success' => false, 'error' => $err];
            }

            if (function_exists('curl_init')) {
                $ch = curl_init('https://api2.ippanel.com/api/v1/sms/send/webservice/single');
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_POST, true);
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
                    'recipient' => [$localPhone],
                    'sender' => $from ?: '+983000505',
                    'message' => $messageText
                ]));
                curl_setopt($ch, CURLOPT_TIMEOUT, 12);
                curl_setopt($ch, CURLOPT_HTTPHEADER, [
                    'Content-Type: application/json',
                    'Authorization: AccessKey ' . $ippanelKey
                ]);
                $rawResponse = curl_exec($ch);
                $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
                curl_close($ch);
                if ($httpCode >= 200 && $httpCode < 300) {
                    logSmsAuditPHP('SEND_SMS', $formattedTo, 'SUCCESS', $rawResponse);
                    return ['success' => true, 'provider' => 'ippanel', 'raw' => $rawResponse];
                }
            }
        }

        // 2. Kavenegar Provider
        if ($provider === 'kavenegar') {
            $kaveKey = $apiKey ?: $username;
            if (empty($kaveKey)) {
                $err = 'کلید API سامانه کاوانگار در تنظیمات ثبت نشده است.';
                logSmsAuditPHP('SEND_SMS', $formattedTo, 'CONFIG_MISSING', $err);
                return ['success' => false, 'error' => $err];
            }
            $url = 'https://api.kavenegar.com/v1/' . urlencode($kaveKey) . '/sms/send.json?receptor=' . urlencode($localPhone) . '&message=' . urlencode($messageText) . (!empty($from) ? '&sender=' . urlencode($from) : '');
            if (function_exists('curl_init')) {
                $ch = curl_init($url);
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_TIMEOUT, 12);
                $rawResponse = curl_exec($ch);
                $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
                curl_close($ch);
                $kaveJson = @json_decode($rawResponse, true);
                if ($httpCode === 200 && isset($kaveJson['return']['status']) && $kaveJson['return']['status'] === 200) {
                    logSmsAuditPHP('SEND_SMS', $formattedTo, 'SUCCESS', $rawResponse);
                    return ['success' => true, 'provider' => 'kavenegar', 'raw' => $rawResponse];
                }
                $errMsg = $kaveJson['return']['message'] ?? 'خطا در وب‌سرویس کاوانگار';
                logSmsAuditPHP('SEND_SMS', $formattedTo, 'ERROR', $errMsg);
                return ['success' => false, 'error' => $errMsg];
            }
        }

        // 3. Default: MeliPayamak (SendSimpleSMS2)
        if (empty($username) || empty($password) || empty($from)) {
            $err = 'اطلاعات سامانه ملی‌پیامک (نام کاربری، رمز عبور یا شماره خط فرستنده) در تنظیمات یا متغیرهای سرور یافت نشد.';
            logSmsAuditPHP('SEND_SMS', (string)$toPhone, 'CONFIG_MISSING', $err);
            return [
                'success' => false,
                'error' => $err
            ];
        }

        $postData = http_build_query([
            'username' => $username,
            'password' => $password,
            'from' => $from,
            'to' => $formattedTo,
            'text' => $messageText,
            'isflash' => 'false'
        ]);

        $rawResponse = '';
        $httpCode = 0;
        $curlError = '';

        if (function_exists('curl_init')) {
            $ch = curl_init('https://api.payamak-panel.com/post/Send.asmx/SendSimpleSMS2');
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
            curl_setopt($ch, CURLOPT_TIMEOUT, 12);
            curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 6);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
            curl_setopt($ch, CURLOPT_USERAGENT, 'LorenCut-Salon-Production/2.0');
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Content-Type: application/x-www-form-urlencoded; charset=utf-8',
                'Accept: */*'
            ]);
            $rawResponse = curl_exec($ch);
            $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlError = curl_error($ch);
            curl_close($ch);

            if ($curlError) {
                logSmsAuditPHP('SEND_SMS', $formattedTo, 'CURL_ERROR', $curlError);
                return ['success' => false, 'error' => 'خطای ارتباط cURL با سامانه پیامک: ' . $curlError];
            }
        } else {
            $opts = [
                'http' => [
                    'method' => 'POST',
                    'header' => "Content-Type: application/x-www-form-urlencoded; charset=utf-8\r\nUser-Agent: LorenCut-Salon-Production/2.0\r\n",
                    'content' => $postData,
                    'timeout' => 12
                ],
                'ssl' => [
                    'verify_peer' => false,
                    'verify_peer_name' => false
                ]
            ];
            $context = stream_context_create($opts);
            $rawResponse = @file_get_contents('https://api.payamak-panel.com/post/Send.asmx/SendSimpleSMS2', false, $context);
            $httpCode = $rawResponse !== false ? 200 : 500;
        }

        $cleanVal = trim(strip_tags((string)$rawResponse));

        if (is_numeric($cleanVal)) {
            $valNum = (float)$cleanVal;
            if ($valNum > 1000) {
                logSmsAuditPHP('SEND_SMS', $formattedTo, 'SUCCESS', 'شناسه ارسال: ' . $cleanVal, $cleanVal);
                return ['success' => true, 'recId' => $cleanVal, 'message' => 'پیامک با موفقیت ارسال شد.'];
            }
            $errorMap = [
                '0' => 'نام کاربری یا رمز عبور سامانه پیامک اشتباه است.',
                '1' => 'درخواست نامعتبر در سامانه پیامک.',
                '2' => 'اعتبار پیامک شما در پنل پیامک کافی نیست. لطفاً پنل را شارژ کنید.',
                '3' => 'محدودیت تعداد ارسال روزانه وجود دارد.',
                '4' => 'محدودیت حجم ارسال پیامک وجود دارد.',
                '5' => 'شماره فرستنده در سامانه پیامک نامعتبر یا تایید نشده است.',
                '6' => 'سامانه پیامکی موقتاً در حال بروزرسانی است.',
                '7' => 'متن پیامک حاوی کلمات فیلتر شده است.',
                '8' => 'عدم رسیدن به حداقل تعداد ارسال مجاز.',
                '9' => 'ارسال از خطوط عمومی از طریق وب‌سرویس امکان‌پذیر نیست.',
                '10' => 'حساب کاربری سامانه پیامک مسدود شده است.',
                '11' => 'شماره گیرنده در لیست سیاه مخابرات (عدم دریافت پیامک تبلیغاتی) است.',
                '12' => 'مدارک پنل پیامک هنوز تایید نهایی نشده است.'
            ];
            $msg = $errorMap[$cleanVal] ?? ('کد خطای سامانه پیامک: ' . $cleanVal);
            logSmsAuditPHP('SEND_SMS', $formattedTo, 'REJECTED_BY_GATEWAY', $msg, $cleanVal);
            return ['success' => false, 'error' => $msg, 'rawCode' => $cleanVal];
        }

        if ($httpCode >= 200 && $httpCode < 300 && !empty($rawResponse)) {
            logSmsAuditPHP('SEND_SMS', $formattedTo, 'SUCCESS_RAW', $rawResponse);
            return ['success' => true, 'raw' => $rawResponse];
        }

        logSmsAuditPHP('SEND_SMS', $formattedTo, 'INVALID_RESPONSE', 'HTTP ' . $httpCode . ' Body: ' . substr((string)$rawResponse, 0, 200));
        return ['success' => false, 'error' => 'پاسخ نامعتبر از درگاه پیامک (کد ' . $httpCode . ')', 'raw' => $rawResponse];
    } catch (Exception $e) {
        logSmsAuditPHP('SEND_SMS', (string)$toPhone, 'EXCEPTION', $e->getMessage());
        return ['success' => false, 'error' => $e->getMessage()];
    }
}

function triggerAppointmentServerSms_PHP($appointment, $siteConfig) {
    try {
        $adminPhone = getFirstNonEmptyPHP(
            $siteConfig['adminPhoneNumber'] ?? null,
            getenv('ADMIN_PHONE'),
            getenv('SMS_ADMIN_PHONE'),
            $_ENV['ADMIN_PHONE'] ?? null,
            '09913272265'
        );
        $dateStr = $appointment['dayName'] ?? ($appointment['dateStr'] ?? '');
        $clientPhone = $appointment['phone'] ?? 'ثبت نشده';
        $adminText = "نوبت جدید در سالن Loren Cut ثبت شد 💈\n👤 مشتری: " . ($appointment['clientName'] ?? 'مشتری') . "\n📞 تلفن: " . $clientPhone . "\n✂️ خدمت: " . ($appointment['serviceName'] ?? 'اصلاح سر') . "\n📅 تاریخ: " . $dateStr . "\n⏰ ساعت: " . ($appointment['timeSlot'] ?? '') . "\n🔑 کد پیگیری: " . ($appointment['trackingCode'] ?? '');
        $res = sendMelipayamakSMS_PHP($adminPhone, $adminText, $siteConfig);
        return $res;
    } catch (Exception $e) {
        logSmsAuditPHP('ADMIN_NOTIFY', '09913272265', 'EXCEPTION', $e->getMessage());
        return ['success' => false, 'error' => $e->getMessage()];
    }
}

function requireAdminAuthPHP($secret) {
    enforceRateLimitPHP('admin_api', 120, 60, 60, 'تعداد درخواست‌های مدیریتی بیش از حد مجاز است. لطفاً کمی صبر کنید.');
    if (!verifyAdminTokenPHP($secret)) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'error' => 'دسترسی غیرمجاز: نشست مدیریت منقضی شده یا نامعتبر است. لطفاً دوباره وارد شوید.'
        ], JSON_UNESCAPED_UNICODE);
        exit();
    }
}

// Rate Limiter
function getClientIpPHP() {
    $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
    if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $ips = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
        $candidate = trim($ips[0]);
        if (filter_var($candidate, FILTER_VALIDATE_IP)) {
            $ip = $candidate;
        }
    }
    return $ip;
}

function enforceRateLimitPHP($action, $maxRequests, $windowSeconds, $lockoutSeconds = 0, $errorMsg = '') {
    $ip = getClientIpPHP();
    $tempDir = @sys_get_temp_dir();
    if (empty($tempDir) || !@is_writable($tempDir)) {
        $tempDir = __DIR__;
    }
    $hash = md5($action . '_' . $ip);
    $rlFile = $tempDir . '/loren_rl_' . $hash . '.json';
    $now = time();

    $record = ['count' => 0, 'firstRequest' => $now, 'lockedUntil' => 0];
    if (file_exists($rlFile)) {
        $content = @file_get_contents($rlFile);
        if ($content) {
            $parsed = @json_decode($content, true);
            if (is_array($parsed) && isset($parsed['count'], $parsed['firstRequest'])) {
                $record = $parsed;
            }
        }
    }

    if (!empty($record['lockedUntil']) && $record['lockedUntil'] > $now) {
        $retryAfter = $record['lockedUntil'] - $now;
        http_response_code(429);
        header('Retry-After: ' . $retryAfter);
        echo json_encode([
            'success' => false,
            'error' => $errorMsg ?: 'تعداد درخواست‌های شما بیش از حد مجاز است. لطفاً چند دقیقه دیگر دوباره امتحان کنید.'
        ], JSON_UNESCAPED_UNICODE);
        exit();
    }

    if (($now - $record['firstRequest']) < $windowSeconds) {
        if ($record['count'] >= $maxRequests) {
            $lockDuration = $lockoutSeconds > 0 ? $lockoutSeconds : $windowSeconds;
            $record['lockedUntil'] = $now + $lockDuration;
            @file_put_contents($rlFile, json_encode($record), LOCK_EX);

            http_response_code(429);
            header('Retry-After: ' . $lockDuration);
            echo json_encode([
                'success' => false,
                'error' => $errorMsg ?: 'تعداد درخواست‌های شما بیش از حد مجاز است. لطفاً چند دقیقه دیگر دوباره امتحان کنید.'
            ], JSON_UNESCAPED_UNICODE);
            exit();
        }
        $record['count']++;
    } else {
        $record['count'] = 1;
        $record['firstRequest'] = $now;
        $record['lockedUntil'] = 0;
    }

    @file_put_contents($rlFile, json_encode($record), LOCK_EX);
}

// Password verification
function verifyPasswordPHP($inputPassword, $storedHash) {
    if (empty($inputPassword) || empty($storedHash)) return false;
    $inputTrimmed = trim((string)$inputPassword);
    $storedTrimmed = trim((string)$storedHash);

    // 1. Password verify (bcrypt / standard)
    if (strpos($storedTrimmed, '$2') === 0 || strpos($storedTrimmed, '$argon2') === 0) {
        if (password_verify($inputTrimmed, $storedTrimmed)) return true;
        if (strpos($storedTrimmed, '$2b$') === 0) {
            $yHash = preg_replace('/^\$2b\$/', '$2y$', $storedTrimmed);
            if (password_verify($inputTrimmed, $yHash)) return true;
        } elseif (strpos($storedTrimmed, '$2a$') === 0) {
            $yHash = preg_replace('/^\$2a\$/', '$2y$', $storedTrimmed);
            if (password_verify($inputTrimmed, $yHash)) return true;
        }
    }

    // 2. Direct match
    if ($inputTrimmed === $storedTrimmed) return true;

    // 3. SHA-256 match
    $sha = hash('sha256', $inputTrimmed);
    if ($sha === $storedTrimmed) return true;

    // 4. Salted SHA-256
    $salted = hash('sha256', 'loren_' . $inputTrimmed);
    if ($salted === $storedTrimmed) return true;

    return false;
}

function autoArchivePastAppointmentsPHP(&$db) {
    if (!isset($db['appointments']) || !is_array($db['appointments'])) return false;
    $todayStr = date('Y-m-d');
    $updated = false;
    foreach ($db['appointments'] as &$app) {
        $dateStr = $app['dateStr'] ?? '';
        $isArchived = !empty($app['archived']) || ($app['status'] ?? '') === 'archived';
        if (!empty($dateStr) && $dateStr < $todayStr && !$isArchived) {
            $app['archived'] = true;
            if (empty($app['archivedAt'])) {
                $app['archivedAt'] = date('Y/m/d H:i');
            }
            $updated = true;
        }
    }
    unset($app);
    return $updated;
}

function loadDB($file, $default) {
    if (file_exists($file)) {
        $content = @file_get_contents($file);
        $json = @json_decode($content, true);
        if (is_array($json)) {
            $mergedSiteConfig = array_merge($default['siteConfig'], $json['siteConfig'] ?? []);

            if (empty($mergedSiteConfig['adminPasswordHash'])) {
                $mergedSiteConfig['adminPasswordHash'] = $default['siteConfig']['adminPasswordHash'];
            }

            $dbLoaded = [
                'siteConfig' => $mergedSiteConfig,
                'services' => !empty($json['services']) ? $json['services'] : $default['services'],
                'contentItems' => $json['contentItems'] ?? $default['contentItems'],
                'appointments' => $json['appointments'] ?? $default['appointments'],
                'customers' => $json['customers'] ?? $default['customers']
            ];

            if (autoArchivePastAppointmentsPHP($dbLoaded)) {
                saveDB($file, $dbLoaded);
            }

            return $dbLoaded;
        }
    }
    saveDB($file, $default);
    return $default;
}

function saveDB($file, $data) {
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    if ($json === false) {
        $json = json_encode($data, JSON_UNESCAPED_UNICODE);
    }
    $tmpFile = $file . '.tmp.' . uniqid();
    $written = @file_put_contents($tmpFile, $json, LOCK_EX);
    if ($written !== false) {
        if (!@rename($tmpFile, $file)) {
            @file_put_contents($file, $json, LOCK_EX);
            @unlink($tmpFile);
        }
    } else {
        @file_put_contents($file, $json, LOCK_EX);
    }
    @chmod($file, 0666);
}

// Data Sanitization for Public View
function getPublicSanitizedData($db) {
    $pubConfig = $db['siteConfig'] ?? [];
    unset($pubConfig['adminUsername']);
    unset($pubConfig['adminPasswordHash']);
    unset($pubConfig['smsUsername']);
    unset($pubConfig['smsPassword']);
    unset($pubConfig['smsApiKey']);
    unset($pubConfig['smsSenderNumber']);

    $pubAppointments = [];
    if (isset($db['appointments']) && is_array($db['appointments'])) {
        foreach ($db['appointments'] as $app) {
            $pubAppointments[] = [
                'id' => $app['id'] ?? '',
                'dateStr' => $app['dateStr'] ?? '',
                'dayName' => $app['dayName'] ?? '',
                'timeSlot' => $app['timeSlot'] ?? '',
                'status' => $app['status'] ?? 'pending',
                'archived' => !empty($app['archived']) || ($app['status'] ?? '') === 'archived',
                'serviceId' => $app['serviceId'] ?? '',
            ];
        }
    }

    return [
        'siteConfig' => $pubConfig,
        'services' => $db['services'] ?? [],
        'contentItems' => $db['contentItems'] ?? [],
        'appointments' => $pubAppointments,
        'customers' => []
    ];
}

$db = loadDB($DATA_FILE, $defaultData);

// Extract Request Route and Method comprehensively from all server environments
$rawRoute = '';
if (isset($_GET['route']) && $_GET['route'] !== '') {
    $rawRoute = trim((string)$_GET['route']);
} elseif (!empty($_SERVER['PATH_INFO'])) {
    $rawRoute = trim((string)$_SERVER['PATH_INFO'], '/');
} elseif (!empty($_SERVER['REDIRECT_URL'])) {
    $rawRoute = trim((string)$_SERVER['REDIRECT_URL'], '/');
} elseif (!empty($_SERVER['REQUEST_URI'])) {
    $parsedUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $scriptDir = dirname($_SERVER['SCRIPT_NAME'] ?? '');
    if ($scriptDir !== '/' && $scriptDir !== '\\' && $scriptDir !== '.') {
        $parsedUri = preg_replace('#^' . preg_quote($scriptDir, '#') . '#', '', $parsedUri);
    }
    $rawRoute = trim($parsedUri, '/');
}

// Normalize Route: strip leading /api.php or /api prefixes if present
$rawRoute = preg_replace('#^api\.php/?#i', '', $rawRoute);
$rawRoute = preg_replace('#^api/?#i', '', $rawRoute);
$rawRoute = trim($rawRoute, '/');

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$rawInput = file_get_contents('php://input');
$input = @json_decode($rawInput, true) ?: [];

// ==========================================
// 2. ROUTE MATCHING & DISPATCH
// ==========================================

// Route: Health Check
if ($rawRoute === 'health' || $rawRoute === 'ping' || $rawRoute === 'status') {
    sendJsonPHP([
        'status' => 'ok',
        'server' => 'php',
        'phpVersion' => PHP_VERSION,
        'dbExists' => file_exists($DATA_FILE),
        'dbWritable' => is_writable($DATA_FILE) || is_writable(dirname($DATA_FILE)),
        'time' => date('Y-m-d H:i:s')
    ], 200);
}

// Route: Admin Login
if ($rawRoute === 'admin/login' || $rawRoute === 'admin_login' || $rawRoute === 'login') {
    if ($method !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Method Not Allowed']);
        exit();
    }

    enforceRateLimitPHP('admin_login', 8, 300, 60, 'تعداد تلاش‌های ناموفق ورود بیش از حد مجاز است. لطفاً کمی بعد مجدداً تلاش نمایید.');

    $username = trim($input['username'] ?? '');
    $password = trim($input['password'] ?? '');

    $expectedUser = trim($db['siteConfig']['adminUsername'] ?? 'admin');
    $expectedPass = trim($db['siteConfig']['adminPasswordHash'] ?? '$2b$10$GyzFGUBTn.Q/KegEwSOFFe43uFtnxekMUOt3JlanGpcs1YKGQTwPK');

    // Strict Single Source of Truth Authentication: strictly verify password against stored active hash
    $isMatch = (strtolower($username) === strtolower($expectedUser) || (strtolower($username) === 'admin' && strtolower($expectedUser) === 'admin')) &&
        verifyPasswordPHP($password, $expectedPass);

    if ($isMatch) {
        if (empty($db['siteConfig']['adminPasswordHash']) || strpos($db['siteConfig']['adminPasswordHash'], '$2') !== 0) {
            $db['siteConfig']['adminPasswordHash'] = password_hash($password, PASSWORD_BCRYPT);
            saveDB($DATA_FILE, $db);
        }

        $token = generateAdminTokenPHP($username ?: 'admin', $AUTH_SECRET);
        echo json_encode([
            'success' => true,
            'token' => $token,
            'expiresIn' => 86400,
            'message' => 'ورود با موفقیت انجام شد.'
        ], JSON_UNESCAPED_UNICODE);
    } else {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'error' => 'نام کاربری یا رمز عبور اشتباه است.'
        ], JSON_UNESCAPED_UNICODE);
    }
    exit();
}

// Route: Admin Logout
if ($rawRoute === 'admin/logout' || $rawRoute === 'admin_logout' || $rawRoute === 'logout') {
    echo json_encode(['success' => true, 'message' => 'خروج با موفقیت انجام شد.'], JSON_UNESCAPED_UNICODE);
    exit();
}

// Route: Admin SMS Status & Audit Check
if ($rawRoute === 'admin/sms-status' || $rawRoute === 'admin_sms_status') {
    requireAdminAuthPHP($AUTH_SECRET);
    $username = getFirstNonEmptyPHP(
        $db['siteConfig']['smsUsername'] ?? null,
        $db['siteConfig']['smsApiKey'] ?? null,
        getenv('MELIPAYAMAK_USERNAME'),
        getenv('SMS_USERNAME'),
        $_ENV['MELIPAYAMAK_USERNAME'] ?? null,
        $_ENV['SMS_USERNAME'] ?? null
    );
    $password = getFirstNonEmptyPHP(
        $db['siteConfig']['smsPassword'] ?? null,
        $db['siteConfig']['smsApiKey'] ?? null,
        getenv('MELIPAYAMAK_PASSWORD'),
        getenv('SMS_PASSWORD'),
        $_ENV['MELIPAYAMAK_PASSWORD'] ?? null,
        $_ENV['SMS_PASSWORD'] ?? null
    );
    $from = getFirstNonEmptyPHP(
        $db['siteConfig']['smsSenderNumber'] ?? null,
        getenv('MELIPAYAMAK_FROM'),
        getenv('SMS_SENDER'),
        $_ENV['MELIPAYAMAK_FROM'] ?? null,
        $_ENV['SMS_SENDER'] ?? null,
        '50004001'
    );
    $adminPhone = getFirstNonEmptyPHP(
        $db['siteConfig']['adminPhoneNumber'] ?? null,
        getenv('ADMIN_PHONE'),
        getenv('SMS_ADMIN_PHONE'),
        $_ENV['ADMIN_PHONE'] ?? null,
        '09913272265'
    );

    $logFile = sys_get_temp_dir() . '/loren_cut_sms.log';
    $recentLogs = [];
    if (file_exists($logFile)) {
        $lines = @file($logFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if ($lines) {
            $recentLogs = array_slice($lines, -15);
        }
    }

    echo json_encode([
        'success' => true,
        'hasUsername' => !empty($username),
        'hasPassword' => !empty($password),
        'fromLine' => $from,
        'adminPhone' => $adminPhone,
        'curlAvailable' => function_exists('curl_init'),
        'recentLogs' => $recentLogs
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

// Route: Admin Test SMS Trigger
if ($rawRoute === 'admin/test-sms' || $rawRoute === 'admin_test_sms') {
    requireAdminAuthPHP($AUTH_SECRET);
    if ($method !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Method Not Allowed']);
        exit();
    }
    $targetPhone = getFirstNonEmptyPHP(
        $input['phone'] ?? null,
        $db['siteConfig']['adminPhoneNumber'] ?? null,
        '09913272265'
    );
    $testMsg = "تست سامانه پیامک سالن Loren Cut\nزمان: " . date('Y/m/d - H:i:s') . "\nاین یک پیام آزمایشی مدیریتی است.";
    $res = sendMelipayamakSMS_PHP($targetPhone, $testMsg, $db['siteConfig'] ?? []);
    echo json_encode([
        'success' => $res['success'] ?? false,
        'result' => $res,
        'targetPhone' => $targetPhone
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

// Route: Get Global Data (Public vs Admin Authenticated)
if ($rawRoute === 'data' || $rawRoute === 'get_data' || $rawRoute === '') {
    if (autoArchivePastAppointmentsPHP($db)) {
        saveDB($DATA_FILE, $db);
    }

    if (verifyAdminTokenPHP($AUTH_SECRET)) {
        echo json_encode($db, JSON_UNESCAPED_UNICODE);
    } else {
        echo json_encode(getPublicSanitizedData($db), JSON_UNESCAPED_UNICODE);
    }
    exit();
}

// Route: Get Admin Data
if ($rawRoute === 'admin/data' || $rawRoute === 'admin_data') {
    requireAdminAuthPHP($AUTH_SECRET);
    if (autoArchivePastAppointmentsPHP($db)) {
        saveDB($DATA_FILE, $db);
    }
    echo json_encode($db, JSON_UNESCAPED_UNICODE);
    exit();
}

// Route: Save Settings (Admin Only) - POST /api/site-config or /api/admin/save-settings or /api/services
if (
    $rawRoute === 'site-config' ||
    $rawRoute === 'site_config' ||
    $rawRoute === 'admin/save-settings' ||
    $rawRoute === 'save_settings' ||
    $rawRoute === 'services'
) {
    requireAdminAuthPHP($AUTH_SECRET);

    if ($rawRoute === 'services') {
        if (is_array($input)) {
            $db['services'] = $input;
            saveDB($DATA_FILE, $db);
        }
        echo json_encode(['success' => true, 'services' => $db['services']], JSON_UNESCAPED_UNICODE);
        exit();
    }

    $allowedKeys = [
        'brandName', 'cardNumber', 'cardHolder', 'bankName', 'depositAmount',
        'telegramUsername', 'telegramUrl', 'instagramUrl', 'whatsappUrl', 'googleMapsUrl',
        'adminPhoneNumber', 'customTimeSlots', 'disabledTimeSlots', 'smsProvider', 'smsUsername', 'smsPassword',
        'smsApiKey', 'smsSenderNumber', 'smsConfirmTemplate', 'smsReminderTemplate', 'adminUsername'
    ];

    $cfg = null;
    if (isset($input['siteConfig']) && is_array($input['siteConfig'])) {
        $cfg = $input['siteConfig'];
    } elseif (is_array($input) && !isset($input['services'])) {
        $cfg = $input;
    }

    if (is_array($cfg)) {
        foreach ($allowedKeys as $k) {
            if (array_key_exists($k, $cfg)) {
                $db['siteConfig'][$k] = $cfg[$k];
            }
        }
        if (!empty($cfg['adminPasswordHash'])) {
            $newPwd = trim((string)$cfg['adminPasswordHash']);
            if ($newPwd !== '') {
                if (strpos($newPwd, '$2') !== 0) {
                    $newPwd = password_hash($newPwd, PASSWORD_BCRYPT);
                }
                $db['siteConfig']['adminPasswordHash'] = $newPwd;
            }
        }
    }

    if (isset($input['services']) && is_array($input['services'])) {
        $db['services'] = $input['services'];
    }

    saveDB($DATA_FILE, $db);
    echo json_encode([
        'success' => true,
        'siteConfig' => $db['siteConfig'],
        'services' => $db['services']
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

// Route: Permanent Delete ALL Archived Appointments
if ($rawRoute === 'appointments/archived/permanent' || $rawRoute === 'permanent_delete_all_archived') {
    requireAdminAuthPHP($AUTH_SECRET);
    if ($method !== 'DELETE') {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Method Not Allowed']);
        exit();
    }
    $remaining = [];
    $deletedCount = 0;
    foreach ($db['appointments'] as $app) {
        $isArchived = !empty($app['archived']) || (isset($app['status']) && $app['status'] === 'archived');
        if ($isArchived) {
            $deletedCount++;
        } else {
            $remaining[] = $app;
        }
    }
    $db['appointments'] = $remaining;
    saveDB($DATA_FILE, $db);
    echo json_encode(['success' => true, 'deletedCount' => $deletedCount, 'appointments' => $db['appointments']], JSON_UNESCAPED_UNICODE);
    exit();
}

// Route: Permanent Delete Single Archived Appointment - DELETE /api/appointments/:id/permanent
if (preg_match('/^appointments\/(.+)\/permanent$/', $rawRoute, $m) || $rawRoute === 'permanent_delete_appointment') {
    requireAdminAuthPHP($AUTH_SECRET);
    if ($method !== 'DELETE') {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Method Not Allowed']);
        exit();
    }
    $targetId = !empty($m[1]) ? $m[1] : (isset($_GET['id']) ? $_GET['id'] : ($input['id'] ?? ''));
    $targetIndex = -1;
    $targetApp = null;

    foreach ($db['appointments'] as $idx => $app) {
        if (($app['id'] ?? '') === $targetId) {
            $targetIndex = $idx;
            $targetApp = $app;
            break;
        }
    }

    if ($targetIndex === -1 || !$targetApp) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'نوبت مورد نظر یافت نشد.'], JSON_UNESCAPED_UNICODE);
        exit();
    }

    $isArchived = !empty($targetApp['archived']) || (isset($targetApp['status']) && $targetApp['status'] === 'archived');
    if (!$isArchived) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'تنها نوبت‌های موجود در بایگانی قابل حذف کامل هستند.'], JSON_UNESCAPED_UNICODE);
        exit();
    }

    array_splice($db['appointments'], $targetIndex, 1);
    saveDB($DATA_FILE, $db);
    echo json_encode(['success' => true, 'appointments' => $db['appointments']], JSON_UNESCAPED_UNICODE);
    exit();
}

// Route: Appointments Collection (POST /api/appointments or GET)
if ($rawRoute === 'appointments') {
    if ($method === 'POST') {
        enforceRateLimitPHP('booking', 60, 600, 300, 'تعداد درخواست‌های ثبت نوبت شما بیش از حد مجاز است. لطفاً دقایقی دیگر تلاش نمایید.');

        if (!$input || empty($input['id'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'اطلاعات نوبت ناقص است.'], JSON_UNESCAPED_UNICODE);
            exit();
        }

        $newDateStr = sanitizeTextPHP($input['dateStr'] ?? '', 20);
        $newDayName = sanitizeTextPHP($input['dayName'] ?? '', 50);
        $newTimeSlot = sanitizeTextPHP($input['timeSlot'] ?? '', 30);
        $newId = sanitizeTextPHP($input['id'] ?? '', 50);
        $clientName = sanitizeTextPHP($input['clientName'] ?? 'مشتری', 80);
        $rawPhone = $input['phone'] ?? '';
        $cleanPhone = normalizePhonePHP($rawPhone);

        if (empty($newTimeSlot) || (empty($newDateStr) && empty($newDayName))) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'تاریخ و زمان سانس مشخص نشده است.'], JSON_UNESCAPED_UNICODE);
            exit();
        }

        if (empty($cleanPhone) || strlen($cleanPhone) < 10) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'شماره موبایل نامعتبر است.'], JSON_UNESCAPED_UNICODE);
            exit();
        }

        // Double booking check
        $conflict = false;
        foreach ($db['appointments'] as $app) {
            $isCanceled = (isset($app['status']) && $app['status'] === 'canceled');
            $isArchived = !empty($app['archived']) || (isset($app['status']) && $app['status'] === 'archived');
            if ($isCanceled || $isArchived) continue;

            $sameDate = (!empty($app['dateStr']) && $app['dateStr'] === $newDateStr) ||
                        (!empty($app['dayName']) && !empty($newDayName) && $app['dayName'] === $newDayName);
            $sameSlot = (isset($app['timeSlot']) && $app['timeSlot'] === $newTimeSlot);
            if ($sameDate && $sameSlot && (isset($app['id']) && $app['id'] !== $newId)) {
                $conflict = true;
                break;
            }
        }

        if ($conflict) {
            http_response_code(409);
            echo json_encode([
                'success' => false,
                'error' => 'این سانس زمانی قبلاً توسط فرد دیگری رزرو شده است. لطفاً سانس دیگری انتخاب کنید.'
            ], JSON_UNESCAPED_UNICODE);
            exit();
        }

        // Disabled slot check
        $disabledList = isset($db['siteConfig']['disabledTimeSlots']) && is_array($db['siteConfig']['disabledTimeSlots'])
            ? $db['siteConfig']['disabledTimeSlots']
            : [];
        $isSlotDisabled = in_array($newTimeSlot, $disabledList, true) ||
                          (!empty($newDateStr) && in_array("{$newDateStr}_{$newTimeSlot}", $disabledList, true));

        if ($isSlotDisabled) {
            http_response_code(409);
            echo json_encode([
                'success' => false,
                'error' => 'این سانس زمانی غیرفعال است. لطفاً سانس دیگری انتخاب کنید.'
            ], JSON_UNESCAPED_UNICODE);
            exit();
        }

        $receipt = (string)($input['receiptImage'] ?? '');
        if (strlen($receipt) > 7 * 1024 * 1024) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'حجم تصویر فیش واریزی بیش از حد مجاز است.'], JSON_UNESCAPED_UNICODE);
            exit();
        }

        $safeAppointment = [
            'id' => $newId,
            'clientName' => $clientName,
            'phone' => $cleanPhone,
            'dateStr' => $newDateStr,
            'dayName' => $newDayName,
            'timeSlot' => $newTimeSlot,
            'serviceId' => sanitizeTextPHP($input['serviceId'] ?? 's1', 30),
            'serviceName' => sanitizeTextPHP($input['serviceName'] ?? 'اصلاح سر', 100),
            'servicePrice' => sanitizeTextPHP($input['servicePrice'] ?? '', 50),
            'receiptImage' => $receipt,
            'status' => 'pending',
            'createdAt' => sanitizeTextPHP($input['createdAt'] ?? (date('Y/m/d - H:i')), 50),
            'trackingCode' => sanitizeTextPHP($input['trackingCode'] ?? ('LC-' . mt_rand(100000, 999999)), 30),
            'archived' => false,
        ];

        array_unshift($db['appointments'], $safeAppointment);

        // Update Customer Club
        if (!isset($db['customers']) || !is_array($db['customers'])) $db['customers'] = [];
        $foundIndex = -1;
        foreach ($db['customers'] as $idx => $c) {
            if (normalizePhonePHP($c['phone'] ?? '') === $cleanPhone) {
                $foundIndex = $idx;
                break;
            }
        }
        $bookingDate = !empty($newDayName) ? $newDayName : ($newDateStr ?: date('Y/m/d'));
        if ($foundIndex >= 0) {
            $db['customers'][$foundIndex]['totalBookings'] = max(1, ($db['customers'][$foundIndex]['totalBookings'] ?? 1) + 1);
            $db['customers'][$foundIndex]['lastBookingDate'] = $bookingDate;
            $db['customers'][$foundIndex]['lastServiceName'] = $safeAppointment['serviceName'];
            if (!empty($clientName)) $db['customers'][$foundIndex]['name'] = $clientName;
        } else {
            $db['customers'][] = [
                'id' => 'cust-' . $cleanPhone,
                'name' => $clientName,
                'phone' => $cleanPhone,
                'totalBookings' => 1,
                'firstBookingDate' => $bookingDate,
                'lastBookingDate' => $bookingDate,
                'lastServiceName' => $safeAppointment['serviceName'],
                'notes' => '',
                'createdAt' => date('Y/m/d')
            ];
        }

        saveDB($DATA_FILE, $db);

        // Trigger SMS notification strictly to Admin
        triggerAppointmentServerSms_PHP($safeAppointment, $db['siteConfig'] ?? []);

        $isAdmin = verifyAdminTokenPHP($AUTH_SECRET);
        $appointmentsResponse = $isAdmin ? $db['appointments'] : getPublicSanitizedData($db)['appointments'];

        echo json_encode([
            'success' => true,
            'appointment' => $safeAppointment,
            'appointments' => $appointmentsResponse
        ], JSON_UNESCAPED_UNICODE);
        exit();
    }

    if ($method === 'GET') {
        $isAdmin = verifyAdminTokenPHP($AUTH_SECRET);
        $appointmentsResponse = $isAdmin ? $db['appointments'] : getPublicSanitizedData($db)['appointments'];
        echo json_encode(['success' => true, 'appointments' => $appointmentsResponse], JSON_UNESCAPED_UNICODE);
        exit();
    }
}

// Route: Single Appointment Actions - PATCH/DELETE /api/appointments/:id or query aliases
if (preg_match('/^appointments\/(.+)$/', $rawRoute, $m) || $rawRoute === 'update_appointment' || $rawRoute === 'delete_appointment') {
    requireAdminAuthPHP($AUTH_SECRET);
    $targetId = !empty($m[1]) ? $m[1] : (isset($_GET['id']) ? $_GET['id'] : ($input['id'] ?? ''));
    $nowStr = date('Y/m/d - H:i');

    if ($method === 'DELETE' || $rawRoute === 'delete_appointment') {
        // Soft delete / archive
        foreach ($db['appointments'] as &$app) {
            if (($app['id'] ?? '') === $targetId) {
                $app['archived'] = true;
                $app['archivedAt'] = $nowStr;
            }
        }
        unset($app);
        saveDB($DATA_FILE, $db);
        echo json_encode(['success' => true, 'appointments' => $db['appointments']], JSON_UNESCAPED_UNICODE);
        exit();
    }

    if ($method === 'PATCH' || $rawRoute === 'update_appointment') {
        $status = $input['status'] ?? null;
        $archived = isset($input['archived']) ? (bool)$input['archived'] : null;

        foreach ($db['appointments'] as &$app) {
            if (($app['id'] ?? '') === $targetId) {
                if ($status !== null && in_array($status, ['confirmed', 'pending', 'canceled', 'archived'], true)) {
                    $app['status'] = $status;
                }
                if ($archived !== null) {
                    $app['archived'] = $archived;
                    $app['archivedAt'] = $archived ? $nowStr : null;
                }
            }
        }
        unset($app);
        saveDB($DATA_FILE, $db);
        echo json_encode(['success' => true, 'appointments' => $db['appointments']], JSON_UNESCAPED_UNICODE);
        exit();
    }
}

// Route: Customers - GET/POST /api/customers or DELETE /api/customers/:id
if (preg_match('/^customers(?:\/(.+))?$/', $rawRoute, $m) || $rawRoute === 'customers' || $rawRoute === 'save_customer' || $rawRoute === 'delete_customer') {
    requireAdminAuthPHP($AUTH_SECRET);
    $targetId = !empty($m[1]) ? $m[1] : (isset($_GET['id']) ? $_GET['id'] : ($input['id'] ?? ''));

    if ($method === 'GET' && empty($targetId) && $rawRoute !== 'delete_customer') {
        echo json_encode(['success' => true, 'customers' => $db['customers'] ?? []], JSON_UNESCAPED_UNICODE);
        exit();
    }

    if ($method === 'DELETE' || $rawRoute === 'delete_customer') {
        $phone = isset($_GET['phone']) ? $_GET['phone'] : ($input['phone'] ?? '');
        $normPhone = normalizePhonePHP($phone);
        $normTargetId = normalizePhonePHP($targetId);

        $db['customers'] = array_values(array_filter($db['customers'] ?? [], function($c) use ($targetId, $normPhone, $normTargetId) {
            if (!empty($targetId) && ($c['id'] ?? '') === $targetId) return false;
            if (!empty($normTargetId) && normalizePhonePHP($c['phone'] ?? '') === $normTargetId) return false;
            if (!empty($normPhone) && normalizePhonePHP($c['phone'] ?? '') === $normPhone) return false;
            return true;
        }));
        saveDB($DATA_FILE, $db);
        echo json_encode(['success' => true, 'customers' => $db['customers']], JSON_UNESCAPED_UNICODE);
        exit();
    }

    if ($method === 'POST' || $rawRoute === 'save_customer') {
        $cust = $input;
        if (!empty($cust['phone']) || !empty($cust['name'])) {
            $norm = normalizePhonePHP($cust['phone'] ?? '');
            $found = false;
            foreach ($db['customers'] as &$c) {
                if ((!empty($norm) && normalizePhonePHP($c['phone'] ?? '') === $norm) || (($c['id'] ?? '') === ($cust['id'] ?? ''))) {
                    $c['name'] = sanitizeTextPHP($cust['name'] ?? $c['name'], 80);
                    $c['notes'] = sanitizeTextPHP($cust['notes'] ?? ($c['notes'] ?? ''), 300);
                    if (isset($cust['totalBookings'])) $c['totalBookings'] = (int)$cust['totalBookings'];
                    if (isset($cust['lastServiceName'])) $c['lastServiceName'] = sanitizeTextPHP($cust['lastServiceName'], 50);
                    if (isset($cust['lastBookingDate'])) $c['lastBookingDate'] = sanitizeTextPHP($cust['lastBookingDate'], 30);
                    $found = true;
                    break;
                }
            }
            unset($c);
            if (!$found) {
                $newC = [
                    'id' => $cust['id'] ?? ('cust-' . ($norm ?: time())),
                    'name' => sanitizeTextPHP($cust['name'] ?? 'مشتری جدید', 80),
                    'phone' => $norm,
                    'totalBookings' => (int)($cust['totalBookings'] ?? 1),
                    'firstBookingDate' => sanitizeTextPHP($cust['firstBookingDate'] ?? date('Y/m/d'), 30),
                    'lastBookingDate' => sanitizeTextPHP($cust['lastBookingDate'] ?? date('Y/m/d'), 30),
                    'lastServiceName' => sanitizeTextPHP($cust['lastServiceName'] ?? 'ثبت دستی مدیر', 50),
                    'notes' => sanitizeTextPHP($cust['notes'] ?? '', 300),
                    'createdAt' => date('Y/m/d H:i')
                ];
                array_unshift($db['customers'], $newC);
            }
            saveDB($DATA_FILE, $db);
        }
        echo json_encode(['success' => true, 'customers' => $db['customers'] ?? []], JSON_UNESCAPED_UNICODE);
        exit();
    }
}

// Route: Content Items - POST /api/content-items or DELETE /api/content-items/:id
if (preg_match('/^content-items(?:\/(.+))?$/', $rawRoute, $m) || $rawRoute === 'content-items' || $rawRoute === 'add_content' || $rawRoute === 'delete_content') {
    requireAdminAuthPHP($AUTH_SECRET);
    $targetId = !empty($m[1]) ? $m[1] : (isset($_GET['id']) ? $_GET['id'] : ($input['id'] ?? ''));

    if ($method === 'DELETE' || $rawRoute === 'delete_content') {
        $db['contentItems'] = array_values(array_filter($db['contentItems'] ?? [], function($item) use ($targetId) {
            return ($item['id'] ?? '') !== $targetId;
        }));
        saveDB($DATA_FILE, $db);
        echo json_encode(['success' => true, 'contentItems' => $db['contentItems']], JSON_UNESCAPED_UNICODE);
        exit();
    }

    if ($method === 'POST' || $rawRoute === 'add_content') {
        if ($input && !empty($input['id'])) {
            $safeContent = [
                'id' => sanitizeTextPHP($input['id'], 50),
                'title' => sanitizeTextPHP($input['title'] ?? '', 120),
                'category' => sanitizeTextPHP($input['category'] ?? 'imageprompt', 40),
                'folderPath' => sanitizeTextPHP($input['folderPath'] ?? '', 150),
                'description' => sanitizeTextPHP($input['description'] ?? '', 300),
                'mediaType' => in_array($input['mediaType'] ?? '', ['image', 'video'], true) ? $input['mediaType'] : 'image',
                'mediaUrl' => filter_var($input['mediaUrl'] ?? '', FILTER_SANITIZE_URL),
                'createdAt' => sanitizeTextPHP($input['createdAt'] ?? date('Y/m/d'), 30),
                'price' => sanitizeTextPHP($input['price'] ?? '', 40),
                'tags' => is_array($input['tags'] ?? null) ? array_slice($input['tags'], 0, 10) : []
            ];
            array_unshift($db['contentItems'], $safeContent);
            saveDB($DATA_FILE, $db);
        }
        echo json_encode(['success' => true, 'contentItems' => $db['contentItems']], JSON_UNESCAPED_UNICODE);
        exit();
    }
}

// Fallback: If GET request and route is empty or data, return public data
if (($rawRoute === '' || $rawRoute === 'data' || $rawRoute === 'get_data') && $method === 'GET') {
    echo json_encode(getPublicSanitizedData($db), JSON_UNESCAPED_UNICODE);
    exit();
}

// Any other unhandled route
http_response_code(404);
echo json_encode([
    'success' => false,
    'error' => 'مسیر مورد نظر یافت نشد (Route Not Found: ' . $rawRoute . ')'
], JSON_UNESCAPED_UNICODE);
exit();
