import PocketBase from 'pocketbase';

const pbUrl = import.meta.env.VITE_POCKETBASE_URL || 'https://pocketbase.likweitan.eu.org';

export const pb = new PocketBase(pbUrl);
