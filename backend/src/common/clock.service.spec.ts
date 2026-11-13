import { ClockService } from './clock.service.js';

describe('ClockService', () => {
  const clock = new ClockService();

  it('renvoie la date du jour au format AAAA-MM-JJ', () => {
    expect(clock.today(new Date('2026-11-13T10:00:00Z'))).toBe('2026-11-13');
  });

  it('utilise le fuseau de Conakry (UTC+0), pas celui du serveur', () => {
    expect(clock.today(new Date('2026-11-13T23:59:59Z'))).toBe('2026-11-13');
    expect(clock.today(new Date('2026-11-14T00:00:00Z'))).toBe('2026-11-14');
  });
});
