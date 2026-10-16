/** Perfil do jogador — coletado no menu, salvo no GameState */
export interface PlayerProfile {
  name: string;
  /** Identificador do partido escolhido (de `initialParties`) */
  partyId?: string;
}