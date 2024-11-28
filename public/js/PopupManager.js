// Popup Management
export class PopupManager {
  static open(popup) {
      popup.style.display = 'block';
  }

  static close(popup) {
      popup.style.display = 'none';
  }

  static handleOutsideClick(event) {
      if (event.target.classList.contains('popup')) {
          this.close(event.target);
      }
  }
}
