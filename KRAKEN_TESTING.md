# 🐙 КРАКЕН - Инструкция по тестированию

## Что такое Кракен?
**Кракен** - это система локального мониторинга аудио для beLive. Позволяет выводить звук на разные устройства одновременно.

## 🚀 Как протестировать:

### 1. Откройте приложение
- Запустите `index.html` в браузере
- Подождите полной загрузки (появится интерфейс)

### 2. Откройте панель настроек аудио
- Нажмите кнопку **"🎛️ Аудио"** в верхней панели
- Должна открыться панель с настройками устройств

### 3. Откройте диагностику (для отладки)
- Нажмите **Ctrl+Shift+D** - откроется панель диагностики
- Нажмите **"Тест устройств"** - покажет все доступные аудио устройства
- Нажмите **"Тест роутинга"** - проверит подключение системы

## 🎯 Что должно работать:

### ✅ Базовые функции:
1. **Панель настроек** - должна открываться по кнопке "🎛️ Аудио"
2. **Список устройств** - должны показываться ваши аудио устройства
3. **Слайдеры громкости** - должны двигаться и показывать проценты
4. **Кнопка "Применить"** - должна сохранять настройки

### ✅ Диагностика (Ctrl+Shift+D):
1. **Тест устройств** - показывает список всех аудио устройств
2. **Тест роутинга** - проверяет подключение AudioRouter к движку
3. **Логи** - показывает что происходит в системе

## 🔧 Если что-то не работает:

### Откройте консоль браузера (F12):
- Ищите сообщения с 🐙 (Кракен)
- Ищите ошибки красным цветом
- Скопируйте и пришлите логи

### Типичные проблемы:
1. **"AudioRouter не найден"** - файл не загрузился
2. **"Нет доступа к аудио"** - браузер заблокировал доступ к микрофону
3. **"Устройства не найдены"** - проблемы с правами доступа

## 📱 Что тестировать:

### Сценарий 1: Базовая настройка
1. Откройте панель аудио настроек
2. Выберите основное устройство вывода
3. Настройте громкость
4. Нажмите "Применить"

### Сценарий 2: Мониторинг
1. Выберите устройство для мониторинга (например, наушники)
2. Настройте отдельную громкость для мониторинга
3. Попробуйте воспроизвести аудио

### Сценарий 3: Диагностика
1. Нажмите Ctrl+Shift+D
2. Запустите "Тест устройств"
3. Запустите "Тест роутинга"
4. Проверьте логи

## 📝 Что присылать для отладки:

1. **Скриншот панели настроек**
2. **Скриншот диагностики** (Ctrl+Shift+D)
3. **Логи из консоли браузера** (F12)
4. **Описание проблемы** - что ожидали, что получили

## 🎵 Дополнительно:

- Кракен работает только в современных браузерах (Chrome, Firefox, Safari)
- Нужно разрешение на доступ к аудио устройствам
- Некоторые функции могут не работать в HTTP (нужен HTTPS)

---

**Цель тестирования:** Убедиться что система аудио роутинга работает и можно настроить вывод звука на разные устройства.

**Главное:** Если что-то не работает - это нормально! Пришлите логи и мы исправим. 🐙 