(function(){
	// Флаги окружения
	window.__ADMIN__ = window.__ADMIN__ ?? false;
	window.__DEBUG__ = window.__DEBUG__ ?? true; // в dev можно оставить true; в проде выставлять false

	// Простой логгер с уровнями
	const levels = ['debug','info','warn','error'];
	const original = console;
	window.Log = {
		debug: (...args) => { if (window.__DEBUG__) original.debug(...args); },
		info: (...args) => original.info(...args),
		warn: (...args) => original.warn(...args),
		error: (...args) => original.error(...args)
	};
})(); 