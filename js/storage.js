// Работа с localStorage и JSON-файлами

const STORAGE_KEY = 'red_book_omsk_markers';

const Storage = {

  // Загрузить маркеры из localStorage
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Ошибка загрузки:', e);
      return [];
    }
  },

  // Сохранить маркеры в localStorage
  save(markers) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(markers));
    } catch (e) {
      console.error('Ошибка сохранения:', e);
    }
  },

  // Экспорт в файл
  export(markers) {
    const blob = new Blob([JSON.stringify(markers, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'red-book-markers.json';
    a.click();
    URL.revokeObjectURL(url);
  },

  // Импорт из файла
  import(file, callback) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        callback(data);
      } catch (err) {
        alert('Ошибка чтения файла: ' + err.message);
      }
    };
    reader.readAsText(file);
  },

  // -------- Области обитания --------

  loadRegions() {
    try {
      const raw = localStorage.getItem('red_book_omsk_regions');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Ошибка загрузки областей:', e);
      return [];
    }
  },

  saveRegions(regions) {
    try {
      localStorage.setItem('red_book_omsk_regions', JSON.stringify(regions));
    } catch (e) {
      console.error('Ошибка сохранения областей:', e);
    }
  },

  // -------- Линии миграций --------

  loadMigrations() {
    try {
      const raw = localStorage.getItem('red_book_omsk_migrations');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Ошибка загрузки миграций:', e);
      return [];
    }
  },

  saveMigrations(migrations) {
    try {
      localStorage.setItem('red_book_omsk_migrations', JSON.stringify(migrations));
    } catch (e) {
      console.error('Ошибка сохранения миграций:', e);
    }
  },

  exportAll(markers, regions, migrations) {
    const data = {
      version: 3,
      exportedAt: new Date().toISOString(),
      markers: markers,
      regions: regions,
      migrations: migrations || []
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'red-book-omsk.json';
    a.click();
    URL.revokeObjectURL(url);
  },

  importAll(file, callback) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        callback(data);
      } catch (err) {
        alert('Ошибка чтения файла: ' + err.message);
      }
    };
    reader.readAsText(file);
  }
};