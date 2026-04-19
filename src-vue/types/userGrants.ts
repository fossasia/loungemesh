/** Session feature flags that the host can grant per participant. */
export type FeatureKey = 'notes' | 'whiteboard' | 'poll' | 'stage';

export type UserGrants = Record<FeatureKey, boolean>;

export const defaultUserGrants = (): UserGrants => ({
  notes: false,
  whiteboard: false,
  poll: false,
  stage: false,
});

export const fullUserGrants = (): UserGrants => ({
  notes: true,
  whiteboard: true,
  poll: true,
  stage: true,
});
