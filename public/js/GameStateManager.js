/**
 * Класс, отвечающий за управление состоянием игры и отображение сообщений
 */
export class GameStateManager {
    /**
     * Проверяет, решен ли кроссворд
     */
    static checkCrosswordSolved() {
        const cells = document.querySelectorAll('.crossword-cell input');

        for (const input of cells) {
            const userInput = input.value.toUpperCase();
            const correctLetter = input.parentNode.dataset.correctLetter;

            if (userInput !== correctLetter) {
                return false;
            }
        }

        // Отображаем сообщение об успехе
        this.displaySuccessMessage();
        return true;
    }

    /**
     * Отображает сообщение об успехе
     */
    static displaySuccessMessage() {
        const crosswordContainer = document.getElementById('crossword-container');
        const cluesContainer = document.getElementById('clues-container');

        if (crosswordContainer) {
            crosswordContainer.innerHTML = '';
        }
        
        if (cluesContainer) {
            cluesContainer.innerHTML = '';
        }

        const successMessage = document.createElement('div');
        successMessage.classList.add('success-message');
        successMessage.innerHTML = `
            <h2>Поздравляем!</h2>
            <p>Вы успешно решили кроссворд!</p>
        `;

        if (crosswordContainer) {
            crosswordContainer.appendChild(successMessage);
        }
    }

    /**
     * Отображает сообщение об ошибке
     * @param {string} message - Сообщение об ошибке
     */
    static displayError(message) {
        const gameContainer = document.getElementById('crossword-container');
        if (gameContainer) {
            gameContainer.innerHTML = `<div class="error-message">${message}</div>`;
        }
    }
}
