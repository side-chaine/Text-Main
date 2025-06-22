#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import re

def fix_navigation():
    # Читаем файл
    with open('js/piano-keyboard.js', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 1. ИСПРАВЛЯЕМ findNoteInPitchMap
    old_find_method = r'findNoteInPitchMap\(currentTime, direction\) \{.*?return null;\s*\}'
    
    new_find_method = '''findNoteInPitchMap(currentTime, direction) {
        const notes = this.pitchMap.notes;
        
        if (!notes || notes.length === 0) {
            console.warn('⚠️ Питч-карта пуста!');
            return null;
        }

        console.log(`🔍 Поиск ноты: время=${currentTime.toFixed(2)}с, направление=${direction === 1 ? 'вперед' : 'назад'}, всего нот=${notes.length}`);
        
        if (direction === 1) {
            // ВПЕРЕД - используем индексный поиск
            let currentIndex = this.pitchMap.currentIndex || 0;
            
            // Если текущий индекс не установлен, найдем ближайший к текущему времени
            if (currentIndex === 0 || this.pitchMap.currentIndex === undefined) {
                for (let i = 0; i < notes.length; i++) {
                    if (notes[i].time >= currentTime) {
                        currentIndex = i;
                        break;
                    }
                }
            }
            
            // Ищем следующую ноту
            let nextIndex = currentIndex + 1;
            if (nextIndex >= notes.length) {
                nextIndex = notes.length - 1;
                console.log(`🔚 Достигнут конец карты, остаемся на ноте ${nextIndex}`);
            }
            
            this.pitchMap.currentIndex = nextIndex;
            const foundNote = notes[nextIndex];
            console.log(`➡️ Найдена нота вперед: ${foundNote.keyId} в ${foundNote.time.toFixed(2)}с (индекс ${nextIndex})`);
            return foundNote;
            
        } else {
            // НАЗАД - используем индексный поиск
            let currentIndex = this.pitchMap.currentIndex || 0;
            
            // Если текущий индекс не установлен, найдем ближайший к текущему времени
            if (currentIndex === 0 || this.pitchMap.currentIndex === undefined) {
                for (let i = notes.length - 1; i >= 0; i--) {
                    if (notes[i].time <= currentTime) {
                        currentIndex = i;
                        break;
                    }
                }
            }
            
            // Ищем предыдущую ноту
            let prevIndex = currentIndex - 1;
            if (prevIndex < 0) {
                prevIndex = 0;
                console.log(`🔚 Достигнуто начало карты, остаемся на ноте 0`);
            }
            
            this.pitchMap.currentIndex = prevIndex;
            const foundNote = notes[prevIndex];
            console.log(`⬅️ Найдена нота назад: ${foundNote.keyId} в ${foundNote.time.toFixed(2)}с (индекс ${prevIndex})`);
            return foundNote;
        }
        
        return null;
    }'''
    
    content = re.sub(old_find_method, new_find_method, content, flags=re.DOTALL)
    
    # 2. ДОБАВЛЯЕМ protectedFromUpdate в simulateNoteFromPitchMap
    old_simulate = r'(this\.currentActiveNote\.protectedFromCleanup = true;)'
    new_simulate = r'\1\n            this.currentActiveNote.protectedFromUpdate = true; // ЗАЩИТА ОТ ОБНОВЛЕНИЙ\n            // ФИКСИРУЕМ ДЛИТЕЛЬНОСТЬ - НЕ ПОЗВОЛЯЕМ ЕЙ РАСТИ\n            this.currentActiveNote.lastDetection = this.currentActiveNote.startTime;'
    
    content = re.sub(old_simulate, new_simulate, content)
    
    # 3. УСИЛИВАЕМ ЗАЩИТУ в updateExistingNote
    old_update_check = r'(if \(noteData\.isSimulated \|\| noteData\.fromPitchMap \|\| noteData\.protectedFromCleanup\) \{)'
    new_update_check = r'if (noteData.isSimulated || noteData.fromPitchMap || noteData.protectedFromCleanup || noteData.protectedFromUpdate) {'
    
    content = re.sub(old_update_check, new_update_check, content)
    
    # Записываем обратно
    with open('js/piano-keyboard.js', 'w', encoding='utf-8') as f:
        f.write(content)
    
    print('✅ Навигация исправлена!')

if __name__ == '__main__':
    fix_navigation() 