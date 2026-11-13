import { useRef, useState } from 'react';
import { t } from '../lib/i18n.js';
import { cleanBarcode, isValidGtin, normalizeBarcode } from '../lib/lookup.js';

/**
 * Manual barcode entry + "read from a photo". Used on the home screen and as
 * the camera fallback inside the scanner overlay.
 * onCode(code, format) is called with a barcode ready for lookup.
 */
export default function BarcodeEntry({ lang, onCode, autoFocus = false }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(null);
  const [reading, setReading] = useState(false);
  const fileRef = useRef(null);

  const submit = (e) => {
    e.preventDefault();
    const digits = cleanBarcode(value);
    if (![8, 12, 13, 14].includes(digits.length)) return setError('barcodeInvalid');
    if (!isValidGtin(digits)) return setError('barcodeChecksum');
    setError(null);
    onCode(digits, null);
  };

  const onPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow choosing the same file again
    if (!file) return;
    setError(null);
    setReading(true);
    try {
      const { decodeImageFile } = await import('../lib/scanner.js');
      const scan = await decodeImageFile(file);
      const code = normalizeBarcode(scan.code, scan.format);
      if (!code) throw new Error('no code');
      onCode(code, scan.format);
    } catch {
      setError('photoNoCode');
    } finally {
      setReading(false);
    }
  };

  return (
    <div className="barcode-entry">
      <form className="barcode-form" onSubmit={submit}>
        <label htmlFor="barcode" className="sr-only">{t(lang, 'barcodeLabel')}</label>
        <input
          id="barcode"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          enterKeyHint="search"
          pattern="[0-9 \-]*"
          placeholder={t(lang, 'barcodePlaceholder')}
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => { setValue(e.target.value); setError(null); }}
          aria-invalid={!!error}
          aria-describedby={error ? 'barcode-error' : undefined}
        />
        <button type="submit" className="btn primary" disabled={!cleanBarcode(value)}>
          {t(lang, 'search')}
        </button>
      </form>
      <button type="button" className="btn ghost block photo-btn" onClick={() => fileRef.current?.click()} disabled={reading}>
        <span aria-hidden="true">🖼️</span> {t(lang, reading ? 'photoReading' : 'fromPhoto')}
      </button>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPhoto} />
      {error && <p id="barcode-error" className="form-error" role="alert">{t(lang, error)}</p>}
    </div>
  );
}
