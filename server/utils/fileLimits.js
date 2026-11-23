// Единые лимиты для загружаемых файлов и текста, отправляемого в LLM.
// Значения используются и в multer, и в FileManager, и в контроллере.
const MB = 1024 * 1024;

const MAX_FILE_SIZE_BYTES = 10 * MB;
const MAX_LLM_TEXT_CHARS = 60_000;

module.exports = { MB, MAX_FILE_SIZE_BYTES, MAX_LLM_TEXT_CHARS };
