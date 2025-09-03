
export type ImageStatus = 'pending' | 'done' | 'error' | 'placeholder';

export interface GeneratedImage {
    status: ImageStatus;
    url?: string;
    error?: string;
}
