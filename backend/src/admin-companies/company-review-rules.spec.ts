import { byReviewPriority, type AdminCompany } from './admin-company.js';
import { reviewData, reviewRefusal } from './company-review-rules.js';

const NOW = new Date('2026-11-19T10:00:00.000Z');

describe('reviewRefusal', () => {
  it('autorise toute décision qui change le statut', () => {
    expect(reviewRefusal('PENDING', 'APPROVED')).toBeNull();
    expect(reviewRefusal('PENDING', 'REJECTED')).toBeNull();
    expect(reviewRefusal('APPROVED', 'REJECTED')).toBeNull();
    expect(reviewRefusal('REJECTED', 'APPROVED')).toBeNull();
  });

  it('refuse une décision identique au statut actuel', () => {
    expect(reviewRefusal('APPROVED', 'APPROVED')).toBe(
      'Cette entreprise est déjà approuvée.',
    );
    expect(reviewRefusal('REJECTED', 'REJECTED')).toBe(
      'Cette entreprise est déjà refusée.',
    );
  });
});

describe('reviewData', () => {
  it('un refus garde le motif et date la décision', () => {
    expect(reviewData('REJECTED', 'RCCM manquant', NOW)).toEqual({
      status: 'REJECTED',
      rejectionReason: 'RCCM manquant',
      reviewedAt: NOW,
    });
  });

  it('une approbation efface un ancien motif', () => {
    expect(reviewData('APPROVED', undefined, NOW)).toEqual({
      status: 'APPROVED',
      rejectionReason: null,
      reviewedAt: NOW,
    });
  });
});

describe('byReviewPriority', () => {
  const company = (
    id: string,
    status: AdminCompany['status'],
    createdAt: string,
  ): AdminCompany => ({
    id,
    name: id,
    sector: null,
    city: null,
    status,
    rejectionReason: status === 'REJECTED' ? 'Motif' : null,
    createdAt,
    reviewedAt: null,
    offersCount: 0,
  });

  it('place les entreprises en attente d’abord, puis les plus récentes', () => {
    const sorted = [
      company('approuvée', 'APPROVED', '2026-11-10T00:00:00.000Z'),
      company('attente-ancienne', 'PENDING', '2026-11-01T00:00:00.000Z'),
      company('refusée', 'REJECTED', '2026-11-12T00:00:00.000Z'),
      company('attente-récente', 'PENDING', '2026-11-15T00:00:00.000Z'),
    ].sort(byReviewPriority);
    expect(sorted.map((c) => c.id)).toEqual([
      'attente-récente',
      'attente-ancienne',
      'approuvée',
      'refusée',
    ]);
  });
});
