const EyeIcon = ({ isVisible = false, onClick }) => (
    <svg
        className={isVisible ? 'eye-open' : 'eye-closed'}
        xmlns='http://www.w3.org/2000/svg'
        viewBox='0 0 24 24'
        fill='none'
        strokeWidth='2'
        color='#000'
        onClick={onClick}
        role='button'
        aria-label={isVisible ? 'Скрыть пароль' : 'Показать пароль'}
    >
        {isVisible ? (
            <>
                <path stroke='#2F2D38' strokeLinecap='round' strokeLinejoin='round' d='M3 13c3.6-8 14.4-8 18 0' />
                <path stroke='#2F2D38' strokeLinecap='round' strokeLinejoin='round' d='M12 17a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z' />
            </>
        ) : (
            <path
                stroke='#2F2D38'
                strokeLinecap='round'
                strokeLinejoin='round'
                d='m19.5 16-2.475-3.396M12 17.5V14M4.5 16l2.469-3.388M3 8c3.6 8 14.4 8 18 0'
            />
        )}
    </svg>
);

export default EyeIcon;
