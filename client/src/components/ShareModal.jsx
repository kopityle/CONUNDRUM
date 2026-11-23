import React, { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import '../css/shareModal.css';

const copyText = async (text) => {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch (error) {
        // Fall back to the legacy selection-based copy below.
    }

    try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.top = '-1000px';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const copied = Boolean(document.execCommand?.('copy'));
        document.body.removeChild(textarea);
        return copied;
    } catch (error) {
        return false;
    }
};

const ShareModal = ({ shareId, name, onClose }) => {
    const [copied, setCopied] = useState(false);
    const [copyError, setCopyError] = useState('');

    const link = useMemo(
        () => `${import.meta.env.VITE_CLIENT_URL || window.location.origin}/play/${shareId}`,
        [shareId]
    );

    const handleCopy = async () => {
        const success = await copyText(link);
        if (success) {
            setCopied(true);
            setCopyError('');
        } else {
            setCopyError('Не удалось скопировать. Выделите ссылку вручную.');
        }
    };

    return (
        <div
            className='shared-game-overlay'
            onClick={(event) => {
                if (event.target === event.currentTarget) onClose?.();
            }}
        >
            <div className='shared-game-modal glass-surface' role='dialog' aria-modal='true' aria-label='Поделиться с классом'>
                <button
                    type='button'
                    className='shared-game-close'
                    aria-label='Закрыть'
                    onClick={onClose}
                >
                    ×
                </button>
                <h2>Поделиться с классом</h2>
                {name && <p className='shared-game-name'>{name}</p>}

                <div className='shared-game-qr' aria-label='QR-код ссылки на игру'>
                    <QRCodeSVG value={link} size={180} />
                </div>

                <label className='shared-game-link-label' htmlFor='shared-game-link'>Ссылка для учеников</label>
                <div className='shared-game-link-row'>
                    <input
                        id='shared-game-link'
                        className='shared-game-link'
                        type='text'
                        readOnly
                        value={link}
                        onFocus={(event) => event.target.select()}
                    />
                    <button type='button' className='shared-game-copy-button' onClick={handleCopy}>
                        {copied ? 'Скопировано!' : 'Скопировать'}
                    </button>
                </div>
                {copyError && <p className='shared-game-copy-error' role='alert'>{copyError}</p>}
                <p className='shared-game-hint'>Ученики смогут открыть игру по ссылке или отсканировать QR-код без регистрации.</p>
            </div>
        </div>
    );
};

export default ShareModal;
