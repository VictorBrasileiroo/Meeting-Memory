import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Button } from '../src/components/ui/button';
import { Input } from '../src/components/ui/input';
import { NativeSelect } from '../src/components/ui/native-select';
import '../src/lib/ui-csp';
import { settingsSchema, DEFAULT_SETTINGS } from '../src/storage/settings';

describe('foundation form and composition contracts', () => {
  it('keeps the existing settings contract under the CSP interpreter', () => {
    expect(settingsSchema.parse(DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS);
    expect(settingsSchema.safeParse({ ...DEFAULT_SETTINGS, retention: 'invalid' }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...DEFAULT_SETTINGS, unexpected: true }).success).toBe(false);
  });
  it('does not submit a form accidentally but preserves explicit submit', () => {
    expect(renderToStaticMarkup(<Button>Mostrar chave</Button>)).toContain('type="button"');
    expect(renderToStaticMarkup(<Button type="submit">Salvar</Button>)).toContain('type="submit"');
  });
  it('keeps an asChild link as a link without a button-only type', () => {
    const html = renderToStaticMarkup(<Button asChild><a href="#source">Fonte</a></Button>);
    expect(html).toContain('href="#source"');
    expect(html).not.toContain('type="button"');
    expect(html).not.toContain('<button');
  });
  it('preserves masking, description and disabled state of a key field', () => {
    const html = renderToStaticMarkup(<Input id="key" type="password" value="sample" disabled aria-describedby="key-help" readOnly />);
    expect(html).toContain('type="password"');
    expect(html).toContain('aria-describedby="key-help"');
    expect(html).toContain('disabled=""');
  });
  it('keeps profile selection native and forwards its value and form attributes', () => {
    const html = renderToStaticMarkup(<NativeSelect id="profile" name="profile" defaultValue="research" disabled><option value="general">Geral</option><option value="research">Pesquisa</option></NativeSelect>);
    expect(html).toContain('<select');
    expect(html).toContain('name="profile"');
    expect(html).toContain('value="research" selected=""');
    expect(html).toContain('disabled=""');
  });
});
