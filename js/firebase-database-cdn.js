// Firebase Database Manager for Phone Store Demo - CDN Version
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc, 
  query, 
  where, 
  orderBy,
  onSnapshot,
  serverTimestamp,
  runTransaction
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ===== طبقة تخزين مؤقت للقراءات (ذاكرة + sessionStorage) =====
// الهدف: تقليل قراءات Firestore — كل مجموعة تُجلب مرة واحدة كل TTL بدل جلبها كاملة في كل صفحة/استدعاء.
// أي كتابة (إضافة/تعديل/حذف) تُبطل كاش المجموعة المعنية فوراً.
const READ_CACHE_TTL_MS = 5 * 60 * 1000; // 5 دقائق
const READ_CACHE_PREFIX = 'fsReadCache:';
const readMemoryCache = new Map();

class FirebaseDatabase {
  constructor() {
    this.db = window.firebaseDB;
    this.auth = window.firebaseAuth;
  }

  // ===== أدوات الكاش =====
  _cacheGet(collName) {
    const mem = readMemoryCache.get(collName);
    if (mem && (Date.now() - mem.t) < READ_CACHE_TTL_MS) return mem.data;
    try {
      const raw = sessionStorage.getItem(READ_CACHE_PREFIX + collName);
      if (raw) {
        const entry = JSON.parse(raw);
        if ((Date.now() - entry.t) < READ_CACHE_TTL_MS) {
          readMemoryCache.set(collName, entry);
          return entry.data;
        }
        sessionStorage.removeItem(READ_CACHE_PREFIX + collName);
      }
    } catch (_) { /* sessionStorage غير متاح أو بيانات تالفة */ }
    return null;
  }

  _cacheSet(collName, data) {
    const entry = { t: Date.now(), data };
    readMemoryCache.set(collName, entry);
    try {
      sessionStorage.setItem(READ_CACHE_PREFIX + collName, JSON.stringify(entry));
    } catch (_) { /* تجاوز الحصة: نكتفي بكاش الذاكرة */ }
  }

  invalidateCache(collName) {
    readMemoryCache.delete(collName);
    try { sessionStorage.removeItem(READ_CACHE_PREFIX + collName); } catch (_) { /* تجاهل */ }
  }

  /** جلب مجموعة كاملة عبر الكاش (قراءة واحدة من Firestore كل TTL على الأكثر). */
  async _getCollectionCached(collName, buildQuery = null) {
    const cached = this._cacheGet(collName);
    if (cached) return cached;
    const snap = await getDocs(buildQuery ? buildQuery() : collection(this.db, collName));
    const items = [];
    snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
    console.log(`🔥 Firestore fetch: ${collName} (${items.length} docs)`);
    this._cacheSet(collName, items);
    return items;
  }

  // ===== عداد رقم الباركود (فريد على مستوى المشروع) =====
  /** يُرجع الرقم التالي الفريد للهاتف (مثل "000001") من عداد في Firebase لضمان عدم التكرار. */
  async getNextPhoneNumber() {
    const counterRef = doc(this.db, 'counters', 'phones');
    // عند عدم وجود عداد فقط: نحسب أقصى رقم من مجموعة الهواتف (عبر الكاش) خارج الـ transaction
    // (سابقاً كانت المجموعة كاملة تُقرأ من Firestore في كل إضافة هاتف حتى مع وجود العداد)
    let maxFromPhones = 0;
    try {
      const counterSnap = await getDoc(counterRef);
      if (!counterSnap.exists()) {
        const phones = await this.getPhones();
        phones.forEach((p) => {
          const raw = p.phone_number;
          const n = typeof raw === 'number' ? raw : parseInt(String(raw || '0'), 10);
          if (!isNaN(n)) maxFromPhones = Math.max(maxFromPhones, n);
        });
      }
    } catch (_) { /* تجاهل */ }
    const initialMax = maxFromPhones;
    const nextNum = await runTransaction(this.db, async (transaction) => {
      const counterSnap = await transaction.get(counterRef);
      let next;
      if (!counterSnap.exists()) {
        next = initialMax + 1;
        transaction.set(counterRef, { lastPhoneNumber: next });
      } else {
        const current = counterSnap.data().lastPhoneNumber || 0;
        next = current + 1;
        transaction.update(counterRef, { lastPhoneNumber: next });
      }
      return next;
    });
    return String(nextNum).padStart(6, '0');
  }

  /** التحقق من وجود هاتف بنفس رقم الباركود (للمقارنة الموحدة نص/عدد). */
  async phoneNumberExists(phoneNumber) {
    const normalized = String(phoneNumber || '').trim();
    if (!normalized) return false;
    const q = query(
      collection(this.db, 'phones'),
      where('phone_number', '==', normalized)
    );
    const snap = await getDocs(q);
    if (!snap.empty) return true;
    const numVal = parseInt(normalized, 10);
    if (isNaN(numVal)) return false;
    const qNum = query(
      collection(this.db, 'phones'),
      where('phone_number', '==', numVal)
    );
    const snapNum = await getDocs(qNum);
    return !snapNum.empty;
  }

  // ===== إدارة الهواتف =====
  async addPhone(phoneData) {
    try {
      const phoneNumber = phoneData.phone_number != null ? String(phoneData.phone_number).trim() : '';
      if (!phoneNumber) {
        throw new Error('رقم الباركود (phone_number) مطلوب');
      }
      const exists = await this.phoneNumberExists(phoneNumber);
      if (exists) {
        throw new Error('رقم الباركود مستخدم مسبقاً. يرجى عدم إعادة استخدام نفس الرقم.');
      }
      const docRef = await addDoc(collection(this.db, 'phones'), {
        ...phoneData,
        phone_number: phoneNumber,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      this.invalidateCache('phones');
      console.log('✅ Phone added with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error adding phone:', error);
      throw error;
    }
  }

  async getPhones() {
    try {
      const phones = await this._getCollectionCached('phones');
      console.log('📱 Retrieved phones:', phones.length);
      return phones;
    } catch (error) {
      console.error('❌ Error getting phones:', error);
      throw error;
    }
  }

  async updatePhone(phoneId, phoneData) {
    try {
      await updateDoc(doc(this.db, 'phones', phoneId), {
        ...phoneData,
        updatedAt: serverTimestamp()
      });
      this.invalidateCache('phones');
      console.log('✅ Phone updated:', phoneId);
    } catch (error) {
      console.error('❌ Error updating phone:', error);
      throw error;
    }
  }

  async deletePhone(phoneId) {
    try {
      await deleteDoc(doc(this.db, 'phones', phoneId));
      this.invalidateCache('phones');
      console.log('✅ Phone deleted:', phoneId);
    } catch (error) {
      console.error('❌ Error deleting phone:', error);
      throw error;
    }
  }

  // ===== إدارة الأكسسوارات =====
  async addAccessory(accessoryData) {
    try {
      console.log('🔥 Firebase: محاولة إضافة أكسسوار:', accessoryData);
      
      const docRef = await addDoc(collection(this.db, 'accessories'), {
        ...accessoryData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      this.invalidateCache('accessories');
      console.log('✅ Firebase: تم إضافة الأكسسوار بنجاح! ID:', docRef.id);
      console.log('📂 Firebase: الفئة المحفوظة:', accessoryData.category);
      return docRef.id;
    } catch (error) {
      console.error('❌ Firebase: خطأ في إضافة الأكسسوار:', error);
      throw error;
    }
  }

  async getAccessories() {
    try {
      const accessories = await this._getCollectionCached('accessories');
      console.log('🛍️ Retrieved accessories:', accessories.length);
      return accessories;
    } catch (error) {
      console.error('❌ Error getting accessories:', error);
      throw error;
    }
  }

  async updateAccessory(accessoryId, accessoryData) {
    try {
      await updateDoc(doc(this.db, 'accessories', accessoryId), {
        ...accessoryData,
        updatedAt: serverTimestamp()
      });
      this.invalidateCache('accessories');
      console.log('✅ Accessory updated:', accessoryId);
    } catch (error) {
      console.error('❌ Error updating accessory:', error);
      throw error;
    }
  }

  async deleteAccessory(accessoryId) {
    try {
      await deleteDoc(doc(this.db, 'accessories', accessoryId));
      this.invalidateCache('accessories');
      console.log('✅ Accessory deleted:', accessoryId);
    } catch (error) {
      console.error('❌ Error deleting accessory:', error);
      throw error;
    }
  }

  // ===== إدارة المبيعات =====
  async addSale(saleData) {
    try {
      const docRef = await addDoc(collection(this.db, 'sales'), {
        ...saleData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      this.invalidateCache('sales');
      console.log('✅ Sale added with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error adding sale:', error);
      throw error;
    }
  }

  async getSales() {
    try {
      const sales = await this._getCollectionCached('sales', () =>
        query(collection(this.db, 'sales'), orderBy('createdAt', 'desc'))
      );
      console.log('💰 Retrieved sales:', sales.length);
      return sales;
    } catch (error) {
      console.error('❌ Error getting sales:', error);
      throw error;
    }
  }

  async getSale(saleId) {
    try {
      const saleDoc = await getDoc(doc(this.db, 'sales', saleId));
      if (saleDoc.exists()) {
        return { id: saleDoc.id, ...saleDoc.data() };
      }
      return null;
    } catch (error) {
      console.error('❌ Error getting sale:', error);
      throw error;
    }
  }

  async updateSale(saleId, saleData) {
    try {
      await updateDoc(doc(this.db, 'sales', saleId), {
        ...saleData,
        updatedAt: serverTimestamp()
      });
      this.invalidateCache('sales');
      console.log('✅ Sale updated:', saleId);
    } catch (error) {
      console.error('❌ Error updating sale:', error);
      throw error;
    }
  }

  async deleteSale(saleId) {
    try {
      await deleteDoc(doc(this.db, 'sales', saleId));
      this.invalidateCache('sales');
      console.log('✅ Sale deleted:', saleId);
    } catch (error) {
      console.error('❌ Error deleting sale:', error);
      throw error;
    }
  }

  // ===== إدارة فئات الأكسسوارات =====
  async addAccessoryCategory(categoryData) {
    try {
      const docRef = await addDoc(collection(this.db, 'accessory_categories'), {
        ...categoryData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      this.invalidateCache('accessory_categories');
      console.log('✅ Category added with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error adding category:', error);
      throw error;
    }
  }

  async getAccessoryCategories() {
    try {
      const categories = await this._getCollectionCached('accessory_categories');
      console.log('📂 Retrieved categories:', categories.length);
      return categories;
    } catch (error) {
      console.error('❌ Error getting categories:', error);
      throw error;
    }
  }

  async deleteAccessoryCategory(categoryName) {
    try {
      const categoriesSnapshot = await getDocs(
        query(collection(this.db, 'accessory_categories'), 
              where('arabic_name', '==', categoryName))
      );
      
      const deletePromises = [];
      categoriesSnapshot.forEach((doc) => {
        deletePromises.push(deleteDoc(doc.ref));
      });
      
      await Promise.all(deletePromises);
      this.invalidateCache('accessory_categories');
      console.log('✅ Accessory category deleted:', categoryName);
      return true;
    } catch (error) {
      console.error('❌ Error deleting accessory category:', error);
      throw error;
    }
  }

  // ===== إدارة أنواع الهواتف =====
  async addPhoneType(phoneTypeData) {
    try {
      const docRef = await addDoc(collection(this.db, 'phone_types'), {
        ...phoneTypeData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      this.invalidateCache('phone_types');
      console.log('✅ Phone type added with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error adding phone type:', error);
      throw error;
    }
  }

  async getPhoneTypes() {
    try {
      const phoneTypes = await this._getCollectionCached('phone_types');
      console.log('📱 Retrieved phone types:', phoneTypes.length);
      return phoneTypes;
    } catch (error) {
      console.error('❌ Error getting phone types:', error);
      throw error;
    }
  }

  async deletePhoneType(brand, model) {
    try {
      const phoneTypesSnapshot = await getDocs(
        query(collection(this.db, 'phone_types'), 
              where('brand', '==', brand), 
              where('model', '==', model))
      );
      
      const deletePromises = [];
      phoneTypesSnapshot.forEach((doc) => {
        deletePromises.push(deleteDoc(doc.ref));
      });
      
      await Promise.all(deletePromises);
      this.invalidateCache('phone_types');
      console.log('✅ Phone type deleted:', brand, model);
      return true;
    } catch (error) {
      console.error('❌ Error deleting phone type:', error);
      throw error;
    }
  }

  // ===== البحث =====
  async searchPhones(searchTerm) {
    try {
      const phones = await this.getPhones();
      const filteredPhones = phones.filter(phone => {
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
      console.log('🔍 Search results for phones:', filteredPhones.length);
      return filteredPhones;
    } catch (error) {
      console.error('❌ Error searching phones:', error);
      throw error;
    }
  }

  async searchAccessories(searchTerm) {
    try {
      const accessories = await this.getAccessories();
      const filteredAccessories = accessories.filter(accessory => {
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
      console.log('🔍 Search results for accessories:', filteredAccessories.length);
      return filteredAccessories;
    } catch (error) {
      console.error('❌ Error searching accessories:', error);
      throw error;
    }
  }

  // ===== الاستماع للتغييرات في الوقت الفعلي =====
  onPhonesChange(callback) {
    return onSnapshot(collection(this.db, 'phones'), (snapshot) => {
      const phones = [];
      snapshot.forEach((doc) => {
        phones.push({ id: doc.id, ...doc.data() });
      });
      callback(phones);
    });
  }

  onAccessoriesChange(callback) {
    return onSnapshot(collection(this.db, 'accessories'), (snapshot) => {
      const accessories = [];
      snapshot.forEach((doc) => {
        accessories.push({ id: doc.id, ...doc.data() });
      });
      callback(accessories);
    });
  }

  onSalesChange(callback) {
    return onSnapshot(
      query(collection(this.db, 'sales'), orderBy('createdAt', 'desc')), 
      (snapshot) => {
        const sales = [];
        snapshot.forEach((doc) => {
          sales.push({ id: doc.id, ...doc.data() });
        });
        callback(sales);
      }
    );
  }

  // ===== نظام الصيانة =====
  
  // ===== إدارة المندوبين =====
  async addRep(repData) {
    try {
      const docRef = await addDoc(collection(this.db, 'reps'), {
        ...repData,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      this.invalidateCache('reps');
      console.log('✅ Rep added with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error adding rep:', error);
      throw error;
    }
  }

  async getReps() {
    try {
      const reps = await this._getCollectionCached('reps');
      console.log('✅ Reps loaded:', reps.length);
      return reps;
    } catch (error) {
      console.error('❌ Error getting reps:', error);
      throw error;
    }
  }

  async updateRep(repId, repData) {
    try {
      const repRef = doc(this.db, 'reps', repId);
      await updateDoc(repRef, {
        ...repData,
        updatedAt: serverTimestamp()
      });
      this.invalidateCache('reps');
      console.log('✅ Rep updated:', repId);
    } catch (error) {
      console.error('❌ Error updating rep:', error);
      throw error;
    }
  }

  async deleteRep(repId) {
    try {
      const repRef = doc(this.db, 'reps', repId);
      await deleteDoc(repRef);
      this.invalidateCache('reps');
      console.log('✅ Rep deleted:', repId);
    } catch (error) {
      console.error('❌ Error deleting rep:', error);
      throw error;
    }
  }

  // ===== إدارة الفنيين =====
  async addTechnician(techData) {
    try {
      const docRef = await addDoc(collection(this.db, 'technicians'), {
        ...techData,
        active: true,
        defaultCommissionPercent: techData.defaultCommissionPercent || 0.5,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      this.invalidateCache('technicians');
      console.log('✅ Technician added with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error adding technician:', error);
      throw error;
    }
  }

  async getTechnicians() {
    try {
      const technicians = await this._getCollectionCached('technicians');
      console.log('✅ Technicians loaded:', technicians.length);
      return technicians;
    } catch (error) {
      console.error('❌ Error getting technicians:', error);
      throw error;
    }
  }

  async updateTechnician(techId, techData) {
    try {
      const techRef = doc(this.db, 'technicians', techId);
      await updateDoc(techRef, {
        ...techData,
        updatedAt: serverTimestamp()
      });
      this.invalidateCache('technicians');
      console.log('✅ Technician updated:', techId);
    } catch (error) {
      console.error('❌ Error updating technician:', error);
      throw error;
    }
  }

  async deleteTechnician(techId) {
    try {
      const techRef = doc(this.db, 'technicians', techId);
      await deleteDoc(techRef);
      this.invalidateCache('technicians');
      console.log('✅ Technician deleted:', techId);
    } catch (error) {
      console.error('❌ Error deleting technician:', error);
      throw error;
    }
  }

  // ===== أعمال الصيانة =====
  async addMaintenanceJob(jobData) {
    try {
      // ✅ حساب totalPartCost من البنية الجديدة أو القديمة
      let totalPartCost = 0;
      if (jobData.parts && Array.isArray(jobData.parts) && jobData.parts.length > 0) {
        totalPartCost = jobData.parts.reduce((sum, part) => sum + (Number(part.partCost) || 0), 0);
      } else if (jobData.totalPartCost !== undefined && jobData.totalPartCost !== null) {
        totalPartCost = Number(jobData.totalPartCost) || 0;
      } else if (jobData.partCost !== undefined && jobData.partCost !== null) {
        totalPartCost = Number(jobData.partCost) || 0; // للتوافق مع البيانات القديمة
      }

      // ✅ حساب الأرباح باستخدام الدالة الموحدة مع totalPartCost
      const { profit, techCommission, shopProfit } = this.computeDerived(
        totalPartCost, 
        jobData.amountCharged, 
        jobData.techPercent !== undefined ? jobData.techPercent : 0
      );

      const docRef = await addDoc(collection(this.db, 'maintenanceJobs'), {
        ...jobData,
        totalPartCost, // ✅ حفظ totalPartCost للتأكد من وجوده في المستقبل
        profit,
        techCommission,
        shopProfit,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      this.invalidateCache('maintenanceJobs');
      console.log('✅ Maintenance job added with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error adding maintenance job:', error);
      throw error;
    }
  }

  async getMaintenanceJobs(filters = {}) {
    try {
      // جلب المجموعة كاملة مرة واحدة عبر الكاش، وكل الفلترة تتم محلياً
      // (سابقاً كانت المجموعة كاملة تُقرأ من Firestore عند كل استدعاء/تغيير فلتر)
      let jobs = [...await this._getCollectionCached('maintenanceJobs')];

      if (filters.status) {
        jobs = jobs.filter(job => job.status === filters.status);
      }

      if (filters.techId) {
        jobs = jobs.filter(job => job.techId === filters.techId);
      }

      // تصفية يدوياً حسب التاريخ إذا لزم الأمر
            if (filters.dateFrom) {
              const dateFrom = filters.dateFrom instanceof Date ? filters.dateFrom : new Date(filters.dateFrom);
        jobs = jobs.filter(job => {
                const jobDate = job.visitDate?.seconds ? new Date(job.visitDate.seconds * 1000) : new Date(job.visitDate);
                return jobDate >= dateFrom;
              });
            }
            
            if (filters.dateTo) {
              const dateTo = filters.dateTo instanceof Date ? filters.dateTo : new Date(filters.dateTo);
        jobs = jobs.filter(job => {
                const jobDate = job.visitDate?.seconds ? new Date(job.visitDate.seconds * 1000) : new Date(job.visitDate);
                return jobDate <= dateTo;
              });
            }
            
      // ✅ فلترة المندوب: تدعم البنية الجديدة (parts[]) والقديمة (repId مباشر)
            if (filters.repId) {
        jobs = jobs.filter(job => {
          // البنية الجديدة: البحث في parts[]
          if (job.parts && Array.isArray(job.parts) && job.parts.length > 0) {
            return job.parts.some(part => part.repId === filters.repId);
        }
          // البنية القديمة: repId مباشر
          return job.repId === filters.repId;
        });
      }
        
        // ترتيب النتائج يدوياً دائماً
        jobs.sort((a, b) => {
          const dateA = a.visitDate?.seconds ? new Date(a.visitDate.seconds * 1000) : new Date(a.visitDate);
          const dateB = b.visitDate?.seconds ? new Date(b.visitDate.seconds * 1000) : new Date(b.visitDate);
          return dateB - dateA; // ترتيب تنازلي
        });
        
        console.log('✅ Maintenance jobs loaded:', jobs.length);
        return jobs;
    } catch (error) {
      console.error('❌ Error getting maintenance jobs:', error);
      throw error;
    }
  }

  async updateMaintenanceJob(jobId, jobData) {
    try {
      // ✅ إذا كانت القيم محسوبة مسبقاً (مثل عند completeJob)، استخدمها مباشرة
      if (jobData.profit !== undefined && jobData.techCommission !== undefined && jobData.shopProfit !== undefined) {
        // القيم محسوبة مسبقاً، لا حاجة لإعادة الحساب
        console.log('✅ استخدام القيم المحسوبة مسبقاً:', {
          profit: jobData.profit,
          techCommission: jobData.techCommission,
          shopProfit: jobData.shopProfit
        });
      } else {
        // ✅ إعادة حساب الأرباح إذا تغيرت القيم
        const currentJob = await this.getMaintenanceJob(jobId);
        
        // حساب totalPartCost من البنية الجديدة أو القديمة
        let totalPartCost = 0;
        if (jobData.totalPartCost !== undefined) {
          totalPartCost = Number(jobData.totalPartCost) || 0;
        } else if (jobData.parts && Array.isArray(jobData.parts) && jobData.parts.length > 0) {
          totalPartCost = jobData.parts.reduce((sum, part) => sum + (Number(part.partCost) || 0), 0);
        } else if (jobData.partCost !== undefined) {
          totalPartCost = Number(jobData.partCost) || 0;
        } else if (currentJob.totalPartCost !== undefined) {
          totalPartCost = Number(currentJob.totalPartCost) || 0;
        } else if (currentJob.parts && Array.isArray(currentJob.parts) && currentJob.parts.length > 0) {
          totalPartCost = currentJob.parts.reduce((sum, part) => sum + (Number(part.partCost) || 0), 0);
        } else if (currentJob.partCost !== undefined) {
          totalPartCost = Number(currentJob.partCost) || 0;
        }
        
        const amountCharged = jobData.amountCharged !== undefined ? jobData.amountCharged : currentJob.amountCharged;
        const techPercent = jobData.techPercent !== undefined ? jobData.techPercent : currentJob.techPercent;
        
        if (totalPartCost !== undefined && amountCharged !== undefined) {
          const { profit, techCommission, shopProfit } = this.computeDerived(totalPartCost, amountCharged, techPercent || 0);
        
          jobData.profit = profit;
          jobData.techCommission = techCommission;
          jobData.shopProfit = shopProfit;
          jobData.totalPartCost = totalPartCost; // ✅ حفظ totalPartCost للتأكد من وجوده في المستقبل
        }
      }

      const jobRef = doc(this.db, 'maintenanceJobs', jobId);
      await updateDoc(jobRef, {
        ...jobData,
        updatedAt: serverTimestamp()
      });
      this.invalidateCache('maintenanceJobs');
      console.log('✅ Maintenance job updated:', jobId);
    } catch (error) {
      console.error('❌ Error updating maintenance job:', error);
      throw error;
    }
  }

  async getMaintenanceJob(jobId) {
    try {
      const jobRef = doc(this.db, 'maintenanceJobs', jobId);
      const jobSnap = await getDoc(jobRef);
      if (jobSnap.exists()) {
        return { id: jobSnap.id, ...jobSnap.data() };
      } else {
        throw new Error('Job not found');
      }
    } catch (error) {
      console.error('❌ Error getting maintenance job:', error);
      throw error;
    }
  }

  async deleteMaintenanceJob(jobId) {
    try {
      const jobRef = doc(this.db, 'maintenanceJobs', jobId);
      await deleteDoc(jobRef);
      this.invalidateCache('maintenanceJobs');
      console.log('✅ Maintenance job deleted:', jobId);
    } catch (error) {
      console.error('❌ Error deleting maintenance job:', error);
      throw error;
    }
  }

  // ===== التسويات =====
  async createSettlement(settlementData) {
    try {
      const docRef = await addDoc(collection(this.db, 'settlements'), {
        ...settlementData,
        status: 'open',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      this.invalidateCache('settlements');
      console.log('✅ Settlement created with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error creating settlement:', error);
      throw error;
    }
  }

  async getSettlements(filters = {}) {
    try {
      // جلب عبر الكاش وفلترة محلياً (الكود السابق كان يظلّل دالة query وينهار عند تمرير فلتر)
      let settlements = [...await this._getCollectionCached('settlements')];

      if (filters.type) {
        settlements = settlements.filter(s => s.type === filters.type);
      }

      if (filters.status) {
        settlements = settlements.filter(s => s.status === filters.status);
      }

      console.log('✅ Settlements loaded:', settlements.length);
      return settlements;
    } catch (error) {
      console.error('❌ Error getting settlements:', error);
      throw error;
    }
  }

  async markSettlementPaid(settlementId, notes = '') {
    try {
      const settlementRef = doc(this.db, 'settlements', settlementId);
      await updateDoc(settlementRef, {
        status: 'paid',
        paidAt: serverTimestamp(),
        notes,
        updatedAt: serverTimestamp()
      });
      this.invalidateCache('settlements');
      console.log('✅ Settlement marked as paid:', settlementId);
    } catch (error) {
      console.error('❌ Error marking settlement as paid:', error);
      throw error;
    }
  }

  // ===== دوال الحساب =====
  // ✅ دالة موحّدة لحساب القيم المشتقة
  computeDerived(partCost, amountCharged, techPercent) {
    const pc = Number(partCost) || 0;
    const ac = Number(amountCharged) || 0;
    const tp = (typeof techPercent === 'number' && !isNaN(techPercent)) ? techPercent : 0; // افتراضي 0%
    const profit = ac - pc;                                // الربح الإجمالي
    const techCommission = Math.max(0, profit * tp);       // عمولة الفني
    const shopProfit = profit - techCommission;            // أرباح المحل
    return { profit, techCommission, shopProfit };
  }

  // دوال منفصلة للتوافق مع الكود القديم
  calcProfit(partCost, amountCharged) {
    return Math.max(0, Number((amountCharged - partCost).toFixed(2)));
  }

  calcTechCommission(profit, percent) {
    return Number((profit * percent).toFixed(2));
  }

  calcShopProfit(profit, techCommission) {
    return Number((profit - techCommission).toFixed(2));
  }

  // ===== إدارة المدفوعات =====
  async addPayment(paymentData) {
    try {
      const docRef = await addDoc(collection(this.db, 'payments'), {
        ...paymentData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      this.invalidateCache('payments');
      console.log('✅ Payment added with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error adding payment:', error);
      throw error;
    }
  }

  async getPayments(filters = {}) {
    try {
      // جلب عبر الكاش وفلترة/ترتيب محلياً بدل استعلام Firestore عند كل استدعاء
      const toDateVal = (v) => (v?.seconds ? new Date(v.seconds * 1000) : new Date(v));
      let payments = [...await this._getCollectionCached('payments')];

      if (filters.dateFrom) {
        const dateFrom = filters.dateFrom instanceof Date ? filters.dateFrom : new Date(filters.dateFrom);
        payments = payments.filter(p => toDateVal(p.paymentDate) >= dateFrom);
      }

      if (filters.dateTo) {
        const dateTo = filters.dateTo instanceof Date ? filters.dateTo : new Date(filters.dateTo);
        payments = payments.filter(p => toDateVal(p.paymentDate) <= dateTo);
      }

      if (filters.entityType) {
        payments = payments.filter(p => p.entityType === filters.entityType);
      }

      if (filters.entityId) {
        payments = payments.filter(p => p.entityId === filters.entityId);
      }

      payments.sort((a, b) => toDateVal(b.paymentDate) - toDateVal(a.paymentDate));

      console.log('✅ Payments loaded:', payments.length);
      return payments;
    } catch (error) {
      console.error('❌ Error getting payments:', error);
      throw error;
    }
  }

  async updatePayment(paymentId, paymentData) {
    try {
      const paymentRef = doc(this.db, 'payments', paymentId);
      await updateDoc(paymentRef, {
        ...paymentData,
        updatedAt: serverTimestamp()
      });
      this.invalidateCache('payments');
      console.log('✅ Payment updated:', paymentId);
    } catch (error) {
      console.error('❌ Error updating payment:', error);
      throw error;
    }
  }

  async deletePayment(paymentId) {
    try {
      const paymentRef = doc(this.db, 'payments', paymentId);
      await deleteDoc(paymentRef);
      this.invalidateCache('payments');
      console.log('✅ Payment deleted:', paymentId);
    } catch (error) {
      console.error('❌ Error deleting payment:', error);
      throw error;
    }
  }

  // ===== تقارير التسويات =====
  async getRepSettlements(dateFrom, dateTo) {
    try {
      console.log('🔍 Getting rep settlements from', dateFrom, 'to', dateTo);
      
      const jobs = await this.getMaintenanceJobs({
        status: 'done',
        dateFrom,
        dateTo
      });

      console.log('📊 Found jobs for rep settlements:', jobs.length);

      const repTotals = {};
      
      jobs.forEach(job => {
        // ✅ دعم البنية الجديدة (parts array) والقديمة (repId مباشر)
        if (job.parts && Array.isArray(job.parts) && job.parts.length > 0) {
          // البنية الجديدة: كل قطعة لها مندوب خاص
          job.parts.forEach(part => {
            if (!part.repId) return;
            
            if (!repTotals[part.repId]) {
              repTotals[part.repId] = {
                repId: part.repId,
                repName: part.repName || 'غير محدد',
                jobsCount: 0,
                partCostSum: 0,
                profitSum: 0,
                techCommissionSum: 0,
                shopProfitSum: 0,
                revenueSum: 0
              };
            }
            
            // نضيف تكلفة القطعة فقط (لأن كل قطعة لها مندوب)
            repTotals[part.repId].partCostSum += (Number(part.partCost) || 0);
          });
          
          // نحسب عدد الأعمال والإيرادات مرة واحدة لكل عمل
          // نستخدم أول مندوب في القائمة لتخصيص إحصائيات العمل
          const firstRepId = job.parts[0]?.repId;
          if (firstRepId && repTotals[firstRepId]) {
            repTotals[firstRepId].jobsCount++;
            repTotals[firstRepId].profitSum += (job.profit || 0);
            repTotals[firstRepId].techCommissionSum += (job.techCommission || 0);
            repTotals[firstRepId].shopProfitSum += (job.shopProfit || 0);
            repTotals[firstRepId].revenueSum += (job.amountCharged || 0);
        }
        } else if (job.repId) {
          // البنية القديمة: مندوب واحد للعمل كامل
        if (!repTotals[job.repId]) {
          repTotals[job.repId] = {
            repId: job.repId,
            repName: job.repName || 'غير محدد',
            jobsCount: 0,
            partCostSum: 0,
            profitSum: 0,
            techCommissionSum: 0,
            shopProfitSum: 0,
            revenueSum: 0
          };
        }
        
        repTotals[job.repId].jobsCount++;
        repTotals[job.repId].partCostSum += (job.partCost || 0);
        repTotals[job.repId].profitSum += (job.profit || 0);
        repTotals[job.repId].techCommissionSum += (job.techCommission || 0);
        repTotals[job.repId].shopProfitSum += (job.shopProfit || 0);
        repTotals[job.repId].revenueSum += (job.amountCharged || 0);
        } else {
          console.warn('⚠️ Job missing repId and parts:', job.id);
        }
      });

      const result = Object.values(repTotals);
      console.log('✅ Rep settlements calculated:', result);
      return result;
    } catch (error) {
      console.error('❌ Error getting rep settlements:', error);
      throw error;
    }
  }

  async getTechSettlements(dateFrom, dateTo) {
    try {
      console.log('🔍 Getting tech settlements from', dateFrom, 'to', dateTo);
      
      const jobs = await this.getMaintenanceJobs({
        status: 'done',
        dateFrom,
        dateTo
      });

      console.log('📊 Found jobs for tech settlements:', jobs.length);

      const techTotals = {};
      jobs.forEach(job => {
        if (!job.techId) {
          console.warn('⚠️ Job missing techId:', job);
          return;
        }

        // ✅ حساب totalPartCost من البنية الجديدة أو القديمة
        let totalPartCost = 0;
        if (job.parts && Array.isArray(job.parts) && job.parts.length > 0) {
          totalPartCost = job.parts.reduce((sum, part) => sum + (Number(part.partCost) || 0), 0);
        } else if (job.totalPartCost !== undefined && job.totalPartCost !== null) {
          totalPartCost = Number(job.totalPartCost) || 0;
        } else if (job.partCost !== undefined && job.partCost !== null) {
          totalPartCost = Number(job.partCost) || 0; // للتوافق مع البيانات القديمة
        }

        if (!techTotals[job.techId]) {
          techTotals[job.techId] = {
            techId: job.techId,
            techName: job.techName || 'غير محدد',
            jobsCount: 0,
            partCostSum: 0,
            profitSum: 0,
            techCommissionSum: 0,
            shopProfitSum: 0,
            revenueSum: 0
          };
        }
        
        techTotals[job.techId].jobsCount++;
        techTotals[job.techId].partCostSum += totalPartCost; // ✅ استخدام totalPartCost بدلاً من partCost
        techTotals[job.techId].profitSum += (job.profit || 0);
        techTotals[job.techId].techCommissionSum += (job.techCommission || 0);
        techTotals[job.techId].shopProfitSum += (job.shopProfit || 0);
        techTotals[job.techId].revenueSum += (job.amountCharged || 0);
      });

      const result = Object.values(techTotals);
      console.log('✅ Tech settlements calculated:', result);
      return result;
    } catch (error) {
      console.error('❌ Error getting tech settlements:', error);
      throw error;
    }
  }

  // ===== تهيئة البيانات الافتراضية =====
  async initializeDefaultData() {
    try {
      // تعمل مرة واحدة لكل متصفح — سابقاً كانت تقرأ مجموعة الفئات من Firestore عند كل تحميل صفحة
      const INIT_FLAG = 'fs_defaults_initialized_v1';
      try {
        if (localStorage.getItem(INIT_FLAG)) return;
      } catch (_) { /* تجاهل */ }

      // علامة على مستوى القاعدة: transaction يضمن أن جهازاً واحداً فقط يزرع البيانات الافتراضية
      // (هذا يمنع تكرار الفئات الذي حدث سابقاً عند تسابق أجهزة/تبويبات متعددة)
      const markerRef = doc(this.db, 'settings', 'defaults_initialized');
      const shouldSeed = await runTransaction(this.db, async (tx) => {
        const m = await tx.get(markerRef);
        if (m.exists()) return false;
        tx.set(markerRef, { initializedAt: serverTimestamp() });
        return true;
      });
      if (!shouldSeed) {
        try { localStorage.setItem(INIT_FLAG, '1'); } catch (_) { /* تجاهل */ }
        return;
      }
      // تهيئة فئات الأكسسوارات
      const defaultCategories = [
        { name: 'accessory', arabic_name: 'إكسسوار', description: 'إكسسوارات عامة' },
        { name: 'charger', arabic_name: 'شاحن', description: 'شواحن الهواتف' },
        { name: 'case', arabic_name: 'غلاف', description: 'أغلفة الهواتف' },
        { name: 'screen_protector', arabic_name: 'حماية الشاشة', description: 'حماية شاشة الهاتف' },
        { name: 'cable', arabic_name: 'كابل', description: 'كابلات البيانات والشحن' },
        { name: 'headphone', arabic_name: 'سماعات', description: 'سماعات الهواتف' },
        { name: 'other', arabic_name: 'أخرى', description: 'فئات أخرى' }
      ];

      // التحقق من وجود فئات الأكسسوارات
      const existingCategories = await this.getAccessoryCategories();
      if (existingCategories.length === 0) {
        for (const category of defaultCategories) {
          await this.addAccessoryCategory(category);
        }
        console.log('✅ تم إضافة فئات الأكسسوارات الافتراضية');
      }

      try { localStorage.setItem('fs_defaults_initialized_v1', '1'); } catch (_) { /* تجاهل */ }
      console.log('✅ Default data initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing default data:', error);
    }
  }
}

// إنشاء instance واحد للاستخدام في جميع أنحاء التطبيق
window.firebaseDatabase = new FirebaseDatabase();

// تهيئة البيانات الافتراضية عند تحميل Firebase
window.firebaseDatabase.initializeDefaultData()
  .then(() => {
    console.log('🔥 Firebase Database Manager initialized successfully!');
  })
  .catch(error => {
    console.error('❌ Error initializing Firebase Database:', error);
  });
