const URDU_COPY = {
  Workspace: 'ورک اسپیس',
  Admin: 'ایڈمن',
  Dashboard: 'ڈیش بورڈ',
  'Operations dashboard': 'کاروباری ڈیش بورڈ',
  'Daily sales': 'روزانہ فروخت',
  'Customer records': 'صارفین کا ریکارڈ',
  'Add customer': 'صارف شامل کریں',
  'Edit customer': 'صارف میں ترمیم',
  'Customer not found': 'صارف نہیں ملا',
  Analytics: 'تجزیات',
  'Customer orders': 'صارفین کے آرڈرز',
  'Delivery tracker': 'ڈیلیوری ٹریکر',
  'Entry history': 'اندراج کی تاریخ',
  'All users': 'تمام صارفین',
  'App settings': 'ایپ سیٹنگز',
  'Interface settings': 'یو آئی سیٹنگز',
  Messages: 'پیغامات',
  Notifications: 'اطلاعات',
  Profile: 'پروفائل',
  'Invoice Lookup': 'انوائس تلاش',
  'Invoice center': 'انوائس سینٹر',
  'Bottle designer': 'بوتل ڈیزائنر',
  Customers: 'صارفین',
  Operations: 'آپریشنز',
  Administration: 'انتظامیہ',
  Interface: 'یو آئی',
  'Bottle tools': 'بوتل کے اوزار',
  'Today\'s sales': 'آج کی فروخت',
  'Delivery queue': 'ڈیلیوری قطار',
  Reports: 'رپورٹس',
  'Quick access': 'فوری رسائی',
  'Sales performance, customer growth, and bottle distribution': 'فروخت، صارفین کی ترقی اور بوتلوں کی تقسیم کی مکمل رپورٹ',
  'Find a customer and record a delivery in one focused flow': 'صارف تلاش کریں اور ایک سادہ مرحلے میں ڈیلیوری درج کریں',
  'Customer support conversations': 'صارفین کی معاونت کے پیغامات',
  'Customer portal orders, delivery, payment, and stock alerts': 'آرڈرز، ڈیلیوری، ادائیگی اور اسٹاک کی اطلاعات',
  'Current user and business details': 'موجودہ صارف اور کاروبار کی تفصیلات',
  'Control company details, business features, ordering rules, prices, and data': 'کمپنی، کاروباری سہولتیں، آرڈر کے اصول، قیمتیں اور ڈیٹا کنٹرول کریں',
  'Control appearance, navigation, accessibility, language, and dashboard layout': 'ظاہری شکل، نیویگیشن، رسائی، زبان اور ڈیش بورڈ ترتیب کنٹرول کریں',
  'Search invoices, validate them, and manage payment status': 'انوائس تلاش، تصدیق اور ادائیگی کی حالت تبدیل کریں',
  'A live view of sales, deliveries, collections, and customer activity': 'فروخت، ڈیلیوری، وصولی اور صارفین کی تازہ کاروباری صورتحال',
  'Design the 19L and 1.5L bottle labels with an instant preview': '19 لیٹر اور 1.5 لیٹر بوتل کے لیبل فوری پری ویو کے ساتھ ڈیزائن کریں',
};

export function translateUi(language, value) {
  if (language !== 'ur' || typeof value !== 'string') return value;
  return URDU_COPY[value] || value;
}

export function localeFor(language) {
  return language === 'ur' ? 'ur-PK' : 'en-PK';
}
