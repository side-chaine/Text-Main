/**
 * Скрипт для отладки системы режиссера в консоли браузера
 * Скопируйте и вставьте в консоль браузера (F12)
 */

console.log('🎬 Запуск диагностики системы режиссера...');

// Проверка загрузки классов
function checkClasses() {
    console.log('\n📋 Проверка загрузки классов:');
    console.log('DirectorSystem:', typeof DirectorSystem !== 'undefined' ? '✅ Загружен' : '❌ Не найден');
    console.log('TrainTimelineController:', typeof TrainTimelineController !== 'undefined' ? '✅ Загружен' : '❌ Не найден');
    console.log('DirectorPage:', typeof DirectorPage !== 'undefined' ? '✅ Загружен' : '❌ Не найден');
}

// Проверка инициализации приложения
function checkApp() {
    console.log('\n🚀 Проверка приложения:');
    console.log('window.app:', window.app ? '✅ Инициализировано' : '❌ Не найдено');
    
    if (window.app) {
        console.log('app.directorSystem:', window.app.directorSystem ? '✅ Создано' : '❌ Не найдено');
        console.log('app.directorPage:', window.app.directorPage ? '✅ Создано' : '❌ Не найдено');
        
        if (window.app.directorSystem) {
            console.log('DirectorSystem статус:', window.app.directorSystem.getStatus());
        }
    }
}

// Проверка кнопки режиссера в UI
function checkButton() {
    console.log('\n🎬 Проверка кнопки режиссера:');
    const button = document.getElementById('director-mode-btn');
    console.log('Кнопка в DOM:', button ? '✅ Найдена' : '❌ Не найдена');
    
    if (button) {
        console.log('Текст кнопки:', button.innerHTML);
        console.log('Классы кнопки:', button.className);
        console.log('Родительский контейнер:', button.parentElement?.className);
    }
    
    // Проверяем контейнер кнопок режимов
    const modesContainer = document.querySelector('.mode-buttons');
    console.log('Контейнер режимов:', modesContainer ? '✅ Найден' : '❌ Не найден');
    
    if (modesContainer) {
        console.log('Кнопки в контейнере:', modesContainer.children.length);
        Array.from(modesContainer.children).forEach((btn, index) => {
            console.log(`  ${index + 1}. ${btn.innerHTML} (${btn.className})`);
        });
    }
}

// Проверка CSS стилей
function checkStyles() {
    console.log('\n🎨 Проверка CSS стилей:');
    
    // Проверяем загрузку CSS файла режиссера
    const directorCSS = Array.from(document.styleSheets).find(sheet => 
        sheet.href && sheet.href.includes('director.css')
    );
    console.log('director.css:', directorCSS ? '✅ Загружен' : '❌ Не найден');
    
    // Проверяем наличие CSS правил для режиссера
    const testElement = document.createElement('div');
    testElement.className = 'director-page hidden';
    document.body.appendChild(testElement);
    
    const styles = getComputedStyle(testElement);
    console.log('Стили .director-page:', {
        position: styles.position,
        display: styles.display,
        zIndex: styles.zIndex
    });
    
    document.body.removeChild(testElement);
}

// Тест создания компонентов
function testComponents() {
    console.log('\n🧪 Тестирование компонентов:');
    
    try {
        // Тест DirectorSystem
        if (typeof DirectorSystem !== 'undefined') {
            const testDirector = new DirectorSystem();
            console.log('✅ DirectorSystem создан успешно');
            
            // Тест инициализации
            testDirector.initialize({}).catch(error => {
                console.log('⚠️ Ошибка инициализации DirectorSystem:', error.message);
            });
        }
        
        // Тест TrainTimelineController
        if (typeof TrainTimelineController !== 'undefined') {
            const testTrain = new TrainTimelineController();
            console.log('✅ TrainTimelineController создан успешно');
            
            // Тест загрузки трека
            testTrain.loadTrackStructure({
                title: 'Test Track',
                duration: 180
            });
            console.log('✅ Тестовый трек загружен в TrainTimelineController');
        }
        
        // Тест DirectorPage
        if (typeof DirectorPage !== 'undefined') {
            const mockSystem = { currentTrack: null };
            const testPage = new DirectorPage(mockSystem);
            console.log('✅ DirectorPage создана успешно');
        }
        
    } catch (error) {
        console.log('❌ Ошибка тестирования компонентов:', error.message);
    }
}

// Функция для показа страницы режиссера
function showDirector() {
    if (window.app && window.app.directorPage) {
        window.app.directorPage.show();
        console.log('🎬 Страница режиссера показана');
    } else {
        console.log('❌ DirectorPage не найдена в app');
    }
}

// Функция для скрытия страницы режиссера
function hideDirector() {
    if (window.app && window.app.directorPage) {
        window.app.directorPage.hide();
        console.log('🎬 Страница режиссера скрыта');
    } else {
        console.log('❌ DirectorPage не найдена в app');
    }
}

// Запуск всех проверок
function runAllChecks() {
    console.clear();
    console.log('🎬 === ДИАГНОСТИКА СИСТЕМЫ РЕЖИССЕРА beLive ===\n');
    
    checkClasses();
    checkApp();
    checkButton();
    checkStyles();
    testComponents();
    
    console.log('\n🎭 === ДОСТУПНЫЕ КОМАНДЫ ===');
    console.log('showDirector() - показать страницу режиссера');
    console.log('hideDirector() - скрыть страницу режиссера');
    console.log('runAllChecks() - повторить все проверки');
    console.log('\n✨ Диагностика завершена!');
}

// Экспортируем функции в глобальную область
window.checkClasses = checkClasses;
window.checkApp = checkApp;
window.checkButton = checkButton;
window.checkStyles = checkStyles;
window.testComponents = testComponents;
window.showDirector = showDirector;
window.hideDirector = hideDirector;
window.runAllChecks = runAllChecks;

// Автоматический запуск при загрузке
runAllChecks(); 