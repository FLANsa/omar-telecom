// Firebase Storage Manager - إدارة التخزين المختلط
// يعمل مع Firebase Firestore أو LocalStorage كبديل

// Configuration constants
const CONFIG = {
  STORAGE_KEYS: {
    PHONES: 'phones',
    ACCESSORIES: 'accessories',
    SALES: 'sales',
    PHONE_TYPES: 'phone_types',
    ACCESSORY_CATEGORIES: 'accessory_categories',
    CURRENT_USER: 'current_user'
  }
};

// Default data (تُستخدم عند عدم وصول Firebase أو عندما تكون القاعدة فارغة)
const DEFAULT_PHONE_TYPES = {
  "Apple": ["iPhone 17 Pro Max", "iPhone 17 Pro", "iPhone 17", "iPhone 16 Pro Max", "iPhone 16 Pro", "iPhone 16", "iPhone 15 Pro Max", "iPhone 15 Pro", "iPhone 15", "iPhone 14 Pro Max", "iPhone 14 Pro", "iPhone 14", "iPhone 13 Pro Max", "iPhone 13 Pro", "iPhone 13", "iPhone 12", "iPhone 11", "iPhone X"],
  "Samsung": ["Galaxy S25 Ultra", "Galaxy S25+", "Galaxy S25", "Galaxy S24 Ultra", "Galaxy S24+", "Galaxy S24", "Galaxy S23 Ultra", "Galaxy S23", "Galaxy A55", "Galaxy A54", "Galaxy A34", "Galaxy Note 20", "Galaxy Note 10"],
  "Xiaomi": ["15 Ultra", "15 Pro", "15", "14 Ultra", "14 Pro", "14", "Redmi Note 14 Pro+", "Redmi Note 14 Pro", "Redmi Note 14", "Redmi Note 13 Pro", "Redmi Note 13"],
  "Huawei": ["P60 Pro", "P60", "P50 Pro", "Mate 60 Pro", "Mate 50 Pro", "Nova 11", "Nova 10"],
  "OnePlus": ["12", "11", "10 Pro", "10", "9 Pro", "Nord 3", "Nord 2"],
  "Google": ["Pixel 8 Pro", "Pixel 8", "Pixel 7 Pro", "Pixel 7", "Pixel 6 Pro", "Pixel 6"],
  "Oppo": ["Find X7 Ultra", "Find X6 Pro", "Find X6", "Reno 11 Pro", "Reno 11", "Reno 10 Pro", "Reno 10"],
  "Honor": ["Magic 6 Pro", "Magic 6", "Magic 5 Pro", "X9b", "X9a", "90 Pro", "90"],
  "Realme": ["GT 5 Pro", "GT 5", "GT Neo 5", "GT Neo 4"],
  "Infinix": ["Zero 30", "Note 40 Pro", "Note 40", "Hot 40 Pro", "Hot 40"],
  "Tecno": ["Phantom X2 Pro", "Camon 30 Pro", "Camon 30", "Spark 20 Pro", "Spark 20"],
  "Nothing": ["Phone 2a", "Phone 2", "Phone 1"]
};

const DEFAULT_ACCESSORY_CATEGORIES = [
  { name: 'accessory', arabic_name: 'إكسسوار', description: 'إكسسوارات عامة' },
  { name: 'charger', arabic_name: 'شاحن', description: 'شواحن الهواتف' },
  { name: 'case', arabic_name: 'غلاف', description: 'أغلفة الهواتف' },
  { name: 'screen_protector', arabic_name: 'حماية الشاشة', description: 'حماية شاشة الهاتف' },
  { name: 'cable', arabic_name: 'كابل', description: 'كابلات البيانات والشحن' },
  { name: 'headphone', arabic_name: 'سماعات', description: 'سماعات الهواتف' },
  { name: 'other', arabic_name: 'أخرى', description: 'فئات أخرى' }
];

class FirebaseStorageManager {
  constructor() {
    this.firebaseDB = window.firebaseDatabase;
    this.isFirebaseAvailable = !!(this.firebaseDB && this.firebaseDB.db);
    
    if (this.isFirebaseAvailable) {
      console.log('🔥 Firebase Storage Manager initialized with Firebase');
    } else {
      console.log('💾 Firebase not available, using LocalStorage fallback');
      this.initializeLocalStorage();
    }
  }

  /**
   * Initialize localStorage fallback
   */
  initializeLocalStorage() {
    // Initialize default data if not exists
    if (!this.getPhoneTypes()) {
      this.setPhoneTypes(DEFAULT_PHONE_TYPES);
    }

    if (!this.getAccessoryCategories()) {
      this.setAccessoryCategories(DEFAULT_ACCESSORY_CATEGORIES);
    }

    if (!this.getPhones()) {
      this.setPhones([]);
    }

    if (!this.getAccessories()) {
      this.setAccessories([]);
    }

    if (!this.getSales()) {
      this.setSales([]);
    }
  }

  /**
   * Generic storage methods
   */
  setItem(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Error saving to localStorage:', error);
      return false;
    }
  }

  getItem(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return defaultValue;
    }
  }

  removeItem(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Error removing from localStorage:', error);
      return false;
    }
  }

  /**
   * Phone management
   */
  async getPhones() {
    if (this.isFirebaseAvailable) {
      try {
        return await this.firebaseDB.getPhones();
      } catch (error) {
        console.error('Error getting phones from Firebase:', error);
        return this.getItem(CONFIG.STORAGE_KEYS.PHONES, []);
      }
    }
    return this.getItem(CONFIG.STORAGE_KEYS.PHONES, []);
  }

  async setPhones(phones) {
    if (this.isFirebaseAvailable) {
      console.log('Firebase mode: phones are managed individually');
      return true;
    }
    return this.setItem(CONFIG.STORAGE_KEYS.PHONES, phones);
  }

  async addPhone(phone) {
    if (this.isFirebaseAvailable) {
      try {
        phone.date_added = new Date();
        const phoneId = await this.firebaseDB.addPhone(phone);
        return phoneId;
      } catch (error) {
        console.error('Error adding phone to Firebase:', error);
        return false;
      }
    }
    
    // LocalStorage fallback
    const phones = this.getPhones();
    phone.id = this.generateId();
    phone.date_added = new Date().toISOString();
    phones.push(phone);
    return this.setPhones(phones);
  }

  async updatePhone(phoneId, updatedPhone) {
    if (this.isFirebaseAvailable) {
      try {
        await this.firebaseDB.updatePhone(phoneId, updatedPhone);
        return true;
      } catch (error) {
        console.error('Error updating phone in Firebase:', error);
        return false;
      }
    }
    
    // LocalStorage fallback
    const phones = this.getPhones();
    const index = phones.findIndex(p => p.id === phoneId);
    if (index !== -1) {
      phones[index] = { ...phones[index], ...updatedPhone };
      return this.setPhones(phones);
    }
    return false;
  }

  async deletePhone(phoneId) {
    if (this.isFirebaseAvailable) {
      try {
        await this.firebaseDB.deletePhone(phoneId);
        return true;
      } catch (error) {
        console.error('Error deleting phone from Firebase:', error);
        return false;
      }
    }
    
    // LocalStorage fallback
    const phones = this.getPhones();
    const filteredPhones = phones.filter(p => p.id !== phoneId);
    return this.setPhones(filteredPhones);
  }

  async getPhoneByNumber(phoneNumber) {
    const phones = await this.getPhones();
    return phones.find(p => p.phone_number === phoneNumber);
  }

  async getPhoneBySerial(serialNumber) {
    const phones = await this.getPhones();
    return phones.find(p => p.serial_number === serialNumber);
  }

  /**
   * Accessory management
   */
  async getAccessories() {
    if (this.isFirebaseAvailable) {
      try {
        return await this.firebaseDB.getAccessories();
      } catch (error) {
        console.error('Error getting accessories from Firebase:', error);
        return this.getItem(CONFIG.STORAGE_KEYS.ACCESSORIES, []);
      }
    }
    return this.getItem(CONFIG.STORAGE_KEYS.ACCESSORIES, []);
  }

  async setAccessories(accessories) {
    if (this.isFirebaseAvailable) {
      console.log('Firebase mode: accessories are managed individually');
      return true;
    }
    return this.setItem(CONFIG.STORAGE_KEYS.ACCESSORIES, accessories);
  }

  async addAccessory(accessory) {
    console.log('📦 Storage Manager: محاولة إضافة أكسسوار:', accessory);
    
    if (this.isFirebaseAvailable) {
      try {
        console.log('🔥 Storage Manager: Firebase متاح، إرسال إلى Firebase...');
        accessory.date_added = new Date();
        const accessoryId = await this.firebaseDB.addAccessory(accessory);
        console.log('✅ Storage Manager: تم إضافة الأكسسوار في Firebase، ID:', accessoryId);
        return accessoryId;
      } catch (error) {
        console.error('❌ Storage Manager: خطأ في إضافة الأكسسوار إلى Firebase:', error);
        return false;
      }
    }
    
    console.log('💾 Storage Manager: Firebase غير متاح، حفظ في localStorage...');
    // LocalStorage fallback
    const accessories = this.getAccessories();
    accessory.id = this.generateId();
    accessory.date_added = new Date().toISOString();
    accessories.push(accessory);
    const result = this.setAccessories(accessories);
    console.log('✅ Storage Manager: تم حفظ الأكسسوار في localStorage');
    return result;
  }

  async updateAccessory(accessoryId, updatedAccessory) {
    if (this.isFirebaseAvailable) {
      try {
        await this.firebaseDB.updateAccessory(accessoryId, updatedAccessory);
        return true;
      } catch (error) {
        console.error('Error updating accessory in Firebase:', error);
        return false;
      }
    }
    
    // LocalStorage fallback
    const accessories = this.getAccessories();
    const index = accessories.findIndex(a => a.id === accessoryId);
    if (index !== -1) {
      accessories[index] = { ...accessories[index], ...updatedAccessory };
      return this.setAccessories(accessories);
    }
    return false;
  }

  async deleteAccessory(accessoryId) {
    if (this.isFirebaseAvailable) {
      try {
        await this.firebaseDB.deleteAccessory(accessoryId);
        return true;
      } catch (error) {
        console.error('Error deleting accessory from Firebase:', error);
        return false;
      }
    }
    
    // LocalStorage fallback
    const accessories = this.getAccessories();
    const filteredAccessories = accessories.filter(a => a.id !== accessoryId);
    return this.setAccessories(filteredAccessories);
  }

  /**
   * Sales management
   */
  async getSales() {
    if (this.isFirebaseAvailable) {
      try {
        return await this.firebaseDB.getSales();
      } catch (error) {
        console.error('Error getting sales from Firebase:', error);
        return this.getItem(CONFIG.STORAGE_KEYS.SALES, []);
      }
    }
    return this.getItem(CONFIG.STORAGE_KEYS.SALES, []);
  }

  async setSales(sales) {
    if (this.isFirebaseAvailable) {
      console.log('Firebase mode: sales are managed individually');
      return true;
    }
    return this.setItem(CONFIG.STORAGE_KEYS.SALES, sales);
  }

  async addSale(sale) {
    if (this.isFirebaseAvailable) {
      try {
        sale.date_created = new Date();
        const saleId = await this.firebaseDB.addSale(sale);
        return saleId;
      } catch (error) {
        console.error('Error adding sale to Firebase:', error);
        return false;
      }
    }
    
    // LocalStorage fallback
    const sales = this.getSales();
    sale.id = this.generateId();
    sale.date_created = new Date().toISOString();
    sales.push(sale);
    return this.setSales(sales);
  }

  async updateSale(saleId, updatedSale) {
    if (this.isFirebaseAvailable) {
      try {
        await this.firebaseDB.updateSale(saleId, updatedSale);
        return true;
      } catch (error) {
        console.error('Error updating sale in Firebase:', error);
        return false;
      }
    }
    
    // LocalStorage fallback
    const sales = this.getSales();
    const index = sales.findIndex(s => s.id === saleId);
    if (index !== -1) {
      sales[index] = { ...sales[index], ...updatedSale };
      return this.setSales(sales);
    }
    return false;
  }

  async deleteSale(saleId) {
    if (this.isFirebaseAvailable) {
      try {
        await this.firebaseDB.deleteSale(saleId);
        return true;
      } catch (error) {
        console.error('Error deleting sale from Firebase:', error);
        return false;
      }
    }
    
    // LocalStorage fallback
    const sales = this.getSales();
    const filteredSales = sales.filter(s => s.id !== saleId);
    return this.setSales(filteredSales);
  }

  async getSaleById(saleId) {
    if (this.isFirebaseAvailable) {
      try {
        return await this.firebaseDB.getSale(saleId);
      } catch (error) {
        console.error('Error getting sale from Firebase:', error);
        return null;
      }
    }
    
    const sales = this.getSales();
    return sales.find(s => s.id === saleId);
  }

  /**
   * Phone Types management
   */
  async getPhoneTypes() {
    if (this.isFirebaseAvailable) {
      try {
        console.log('🔄 Storage Manager: تحميل أنواع الهواتف من Firebase...');
        const phoneTypes = await this.firebaseDB.getPhoneTypes();
        console.log('📱 Storage Manager: أنواع الهواتف المحملة:', phoneTypes);
        
        // Convert array to object format for compatibility with existing code
        const phoneTypesObj = {};
        (phoneTypes || []).forEach(type => {
          const manufacturer = type.manufacturer || type.brand; // Support both field names
          if (!phoneTypesObj[manufacturer]) {
            phoneTypesObj[manufacturer] = [];
          }
          phoneTypesObj[manufacturer].push(type.model);
        });
        console.log('🏭 Storage Manager: البيانات المحولة:', phoneTypesObj);
        // عند عدم وجود بيانات (اتصال بطيء أو أوفلاين أو قاعدة فارغة) استخدم القائمة الافتراضية
        if (Object.keys(phoneTypesObj).length === 0) {
          console.log('ℹ️ Storage Manager: استخدام القائمة الافتراضية لأنواع الهواتف (Firebase فارغ أو غير متاح)');
          return typeof DEFAULT_PHONE_TYPES !== 'undefined' ? { ...DEFAULT_PHONE_TYPES } : this.getItem(CONFIG.STORAGE_KEYS.PHONE_TYPES) || {};
        }
        return phoneTypesObj;
      } catch (error) {
        console.error('❌ Storage Manager: خطأ في تحميل أنواع الهواتف من Firebase:', error);
        const local = this.getItem(CONFIG.STORAGE_KEYS.PHONE_TYPES);
        if (local && Object.keys(local).length > 0) return local;
        console.log('ℹ️ Storage Manager: استخدام القائمة الافتراضية لأنواع الهواتف');
        return typeof DEFAULT_PHONE_TYPES !== 'undefined' ? { ...DEFAULT_PHONE_TYPES } : {};
      }
    }
    console.log('💾 Storage Manager: Firebase غير متاح، تحميل من localStorage...');
    const local = this.getItem(CONFIG.STORAGE_KEYS.PHONE_TYPES);
    if (local && Object.keys(local).length > 0) return local;
    return typeof DEFAULT_PHONE_TYPES !== 'undefined' ? { ...DEFAULT_PHONE_TYPES } : {};
  }

  async setPhoneTypes(phoneTypes) {
    if (this.isFirebaseAvailable) {
      console.log('Firebase mode: phone types are managed individually');
      return true;
    }
    return this.setItem(CONFIG.STORAGE_KEYS.PHONE_TYPES, phoneTypes);
  }

  async addPhoneType(brand, model) {
    if (this.isFirebaseAvailable) {
      try {
        await this.firebaseDB.addPhoneType({ brand, model });
        return true;
      } catch (error) {
        console.error('Error adding phone type to Firebase:', error);
        return false;
      }
    }
    
    // LocalStorage fallback
    const phoneTypes = this.getPhoneTypes() || {};
    if (!phoneTypes[brand]) {
      phoneTypes[brand] = [];
    }
    if (!phoneTypes[brand].includes(model)) {
      phoneTypes[brand].push(model);
      return this.setPhoneTypes(phoneTypes);
    }
    return false;
  }

  async deletePhoneType(brand, model) {
    if (this.isFirebaseAvailable) {
      try {
        await this.firebaseDB.deletePhoneType(brand, model);
        return true;
      } catch (error) {
        console.error('Error deleting phone type from Firebase:', error);
        return false;
      }
    }
    
    // LocalStorage fallback
    const phoneTypes = this.getPhoneTypes() || {};
    if (phoneTypes[brand]) {
      phoneTypes[brand] = phoneTypes[brand].filter(m => m !== model);
      if (phoneTypes[brand].length === 0) {
        delete phoneTypes[brand];
      }
      return this.setPhoneTypes(phoneTypes);
    }
    return false;
  }

  /**
   * Accessory Categories management
   */
  async getAccessoryCategories() {
    if (this.isFirebaseAvailable) {
      try {
        const categories = await this.firebaseDB.getAccessoryCategories();
        if (categories && categories.length > 0) return categories;
        console.log('ℹ️ Storage Manager: استخدام القائمة الافتراضية لفئات الأكسسوارات');
        return Array.isArray(DEFAULT_ACCESSORY_CATEGORIES) ? [...DEFAULT_ACCESSORY_CATEGORIES] : (this.getItem(CONFIG.STORAGE_KEYS.ACCESSORY_CATEGORIES) || []);
      } catch (error) {
        console.error('Error getting accessory categories from Firebase:', error);
        const local = this.getItem(CONFIG.STORAGE_KEYS.ACCESSORY_CATEGORIES);
        if (local && local.length > 0) return local;
        return Array.isArray(DEFAULT_ACCESSORY_CATEGORIES) ? [...DEFAULT_ACCESSORY_CATEGORIES] : [];
      }
    }
    const local = this.getItem(CONFIG.STORAGE_KEYS.ACCESSORY_CATEGORIES);
    if (local && local.length > 0) return local;
    return Array.isArray(DEFAULT_ACCESSORY_CATEGORIES) ? [...DEFAULT_ACCESSORY_CATEGORIES] : [];
  }

  async setAccessoryCategories(categories) {
    if (this.isFirebaseAvailable) {
      console.log('Firebase mode: accessory categories are managed individually');
      return true;
    }
    return this.setItem(CONFIG.STORAGE_KEYS.ACCESSORY_CATEGORIES, categories);
  }

  async addAccessoryCategory(category) {
    if (this.isFirebaseAvailable) {
      try {
        await this.firebaseDB.addAccessoryCategory(category);
        return true;
      } catch (error) {
        console.error('Error adding accessory category to Firebase:', error);
        return false;
      }
    }
    
    // LocalStorage fallback
    const categories = this.getAccessoryCategories() || [];
    const exists = categories.find(c => c.name === category.name || c.arabic_name === category.arabic_name);
    if (!exists) {
      categories.push(category);
      return this.setAccessoryCategories(categories);
    }
    return false;
  }

  async deleteAccessoryCategory(categoryName) {
    if (this.isFirebaseAvailable) {
      try {
        await this.firebaseDB.deleteAccessoryCategory(categoryName);
        return true;
      } catch (error) {
        console.error('Error deleting accessory category from Firebase:', error);
        return false;
      }
    }
    
    // LocalStorage fallback
    const categories = this.getAccessoryCategories() || [];
    const filteredCategories = categories.filter(c => c.arabic_name !== categoryName);
    return this.setAccessoryCategories(filteredCategories);
  }

  /**
   * User management
   */
  getCurrentUser() {
    return this.getItem(CONFIG.STORAGE_KEYS.CURRENT_USER);
  }

  setCurrentUser(user) {
    return this.setItem(CONFIG.STORAGE_KEYS.CURRENT_USER, user);
  }

  logout() {
    return this.removeItem(CONFIG.STORAGE_KEYS.CURRENT_USER);
  }

  isLoggedIn() {
    return !!this.getCurrentUser();
  }

  /**
   * Search functionality
   */
  async searchPhones(searchTerm) {
    if (this.isFirebaseAvailable) {
      try {
        return await this.firebaseDB.searchPhones(searchTerm);
      } catch (error) {
        console.error('Error searching phones in Firebase:', error);
        return [];
      }
    }
    
    // LocalStorage fallback
    const phones = await this.getPhones();
    return phones.filter(phone => {
      const searchFields = [
        phone.phone_number,
        phone.serial_number,
        phone.brand,
        phone.model,
        phone.phone_color,
        phone.phone_memory,
        phone.description,
        phone.customer_name,
        phone.customer_id
      ];
      
      return searchFields.some(field => 
        field && field.toString().toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }

  async searchAccessories(searchTerm) {
    if (this.isFirebaseAvailable) {
      try {
        return await this.firebaseDB.searchAccessories(searchTerm);
      } catch (error) {
        console.error('Error searching accessories in Firebase:', error);
        return [];
      }
    }
    
    // LocalStorage fallback
    const accessories = await this.getAccessories();
    return accessories.filter(accessory => {
      const searchFields = [
        accessory.name,
        accessory.category,
        accessory.description,
        accessory.supplier,
        accessory.notes
      ];
      
      return searchFields.some(field => 
        field && field.toString().toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }

  /**
   * Real-time listeners (Firebase only)
   */
  onPhonesChange(callback) {
    if (this.isFirebaseAvailable) {
      return this.firebaseDB.onPhonesChange(callback);
    }
    console.log('Real-time listeners only available with Firebase');
    return null;
  }

  onAccessoriesChange(callback) {
    if (this.isFirebaseAvailable) {
      return this.firebaseDB.onAccessoriesChange(callback);
    }
    console.log('Real-time listeners only available with Firebase');
    return null;
  }

  onSalesChange(callback) {
    if (this.isFirebaseAvailable) {
      return this.firebaseDB.onSalesChange(callback);
    }
    console.log('Real-time listeners only available with Firebase');
    return null;
  }

  /**
   * Utility methods
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Export/Import functionality
   */
  async exportData() {
    const data = {
      phones: await this.getPhones(),
      accessories: await this.getAccessories(),
      sales: await this.getSales(),
      phoneTypes: await this.getPhoneTypes(),
      accessoryCategories: await this.getAccessoryCategories(),
      exportDate: new Date().toISOString(),
      version: '2.0',
      firebaseEnabled: this.isFirebaseAvailable
    };
    return JSON.stringify(data, null, 2);
  }

  async importData(jsonData) {
    try {
      const data = JSON.parse(jsonData);
      
      if (data.phones) {
        for (const phone of data.phones) {
          await this.addPhone(phone);
        }
      }
      if (data.accessories) {
        for (const accessory of data.accessories) {
          await this.addAccessory(accessory);
        }
      }
      if (data.sales) {
        for (const sale of data.sales) {
          await this.addSale(sale);
        }
      }
      if (data.phoneTypes) {
        for (const [brand, models] of Object.entries(data.phoneTypes)) {
          for (const model of models) {
            await this.addPhoneType(brand, model);
          }
        }
      }
      if (data.accessoryCategories) {
        for (const category of data.accessoryCategories) {
          await this.addAccessoryCategory(category);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error importing data:', error);
      return false;
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats() {
    const phones = await this.getPhones();
    const accessories = await this.getAccessories();
    const sales = await this.getSales();
    const phoneTypes = await this.getPhoneTypes();
    const accessoryCategories = await this.getAccessoryCategories();

    return {
      phones: phones.length,
      accessories: accessories.length,
      sales: sales.length,
      phoneTypes: Object.keys(phoneTypes || {}).length,
      accessoryCategories: (accessoryCategories || []).length,
      firebaseEnabled: this.isFirebaseAvailable
    };
  }
}

// إنشاء instance واحد للاستخدام في جميع أنحاء التطبيق
const storage = new FirebaseStorageManager();

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.storage = storage;
  window.FirebaseStorageManager = FirebaseStorageManager;
}

// Make available globally for non-module usage
window.FirebaseStorageManager = FirebaseStorageManager;
window.storage = storage;

// Also export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FirebaseStorageManager, storage };
}
