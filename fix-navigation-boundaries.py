#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import re

def fix_navigation_boundaries():
    # Читаем файл
    with open('js/piano-keyboard.js', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Исправляем метод findNoteInPitchMap с границами
    old_method = r'findNoteInPitchMap\(currentTime, direction\) \{.*?return null;\s*\}'
    
    new_method = '''findNoteInPitchMap(currentTime, direction) {
        const notes = this.pitchMap.notes;
        
        if (!notes || notes.length === 0) {
            console.warn('⚠️ Питч-карта пуста!');
            return null;
        }

        console.log(`🔍 Поиск ноты: время=${currentTime.toFixed(2)}с, направление=${direction === 1 ? 'вперед' : 'назад'}, всего нот=${notes.length}`);
        
        // УСТАНАВЛИВАЕМ ГРАНИЦЫ НАВИГАЦИИ
        const firstNote = notes[0];
        const lastNote = notes[notes.length - 1];
        
        if (direction === 1) {
            // ВПЕРЕД - проверяем достижение конца
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
                // ДОСТИГЛИ КОНЦА ТРЕКА - БЛОКИРУЕМ ДАЛЬНЕЙШУЮ НАВИГАЦИЮ
                console.log(`🔚 КОНЕЦ ТРЕКА: остаемся на последней ноте ${lastNote.keyId} (${lastNote.time.toFixed(2)}с)`);
                this.pitchMap.currentIndex = notes.length - 1;
                return lastNote;
            }
            
            this.pitchMap.currentIndex = nextIndex;
            const foundNote = notes[nextIndex];
            console.log(`➡️ Найдена нота вперед: ${foundNote.keyId} в ${foundNote.time.toFixed(2)}с (индекс ${nextIndex}/${notes.length})`);
            return foundNote;
            
        } else {
            // НАЗАД - проверяем достижение начала
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
                // ДОСТИГЛИ НАЧАЛА ТРЕКА - БЛОКИРУЕМ ДАЛЬНЕЙШУЮ НАВИГАЦИЮ
                console.log(`🔚 НАЧАЛО ТРЕКА: остаемся на первой ноте ${firstNote.keyId} (${firstNote.time.toFixed(2)}с)`);
                this.pitchMap.currentIndex = 0;
                return firstNote;
            }
            
            this.pitchMap.currentIndex = prevIndex;
            const foundNote = notes[prevIndex];
            console.log(`⬅️ Найдена нота назад: ${foundNote.keyId} в ${foundNote.time.toFixed(2)}с (индекс ${prevIndex}/${notes.length})`);
            return foundNote;
        }
        
        return null;
    }'''
    
    content = re.sub(old_method, new_method, content, flags=re.DOTALL)
    
    # Восстанавливаем октавные скачки - смягчаем фильтры
    old_octave_method = r'isHarmonicJump\(newFrequency, currentNote\) \{.*?return false;\s*\}'
    
    new_octave_method = '''isHarmonicJump(newFrequency, currentNote) {
        if (!currentNote) return false;
        
        const currentFreq = currentNote.currentFrequency;
        const ratio = newFrequency / currentFreq;
        const noteDuration = performance.now() - currentNote.startTime;
        
        // 🎯 СМЯГЧЕННЫЕ КРИТЕРИИ: разрешаем больше октавных переходов
        const isOctaveRatio = (
            Math.abs(ratio - 2.0) < 0.08 ||    // Октава вверх (увеличена толерантность)
            Math.abs(ratio - 0.5) < 0.04 ||    // Октава вниз (увеличена толерантность)
            Math.abs(ratio - 4.0) < 0.15 ||    // Две октавы вверх
            Math.abs(ratio - 0.25) < 0.08      // Две октавы вниз
        );
        
        // Блокируем октавные скачки только для ОЧЕНЬ коротких нот (менее 40мс)
        if (isOctaveRatio && noteDuration < 40) {
            console.log(`🚫 Октавный скачок заблокирован: ${currentFreq.toFixed(1)}Hz → ${newFrequency.toFixed(1)}Hz за ${noteDuration.toFixed(0)}мс (ratio: ${ratio.toFixed(2)})`);
            this.detectionStats.harmonicsRejected++;
            return true;
        }
        
        // РАЗРЕШАЕМ все остальные случаи
        if (isOctaveRatio) {
            console.log(`✅ Октавный переход разрешен: ${currentFreq.toFixed(1)}Hz → ${newFrequency.toFixed(1)}Hz за ${noteDuration.toFixed(0)}мс (ratio: ${ratio.toFixed(2)})`);
        }
        
        return false;
    }'''
    
    content = re.sub(old_octave_method, new_octave_method, content, flags=re.DOTALL)
    
    # Записываем обратно
    with open('js/piano-keyboard.js', 'w', encoding='utf-8') as f:
        f.write(content)
    
    print('✅ Навигация с границами и октавные скачки исправлены!')

if __name__ == '__main__':
    fix_navigation_boundaries() 