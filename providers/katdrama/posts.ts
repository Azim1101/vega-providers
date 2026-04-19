import { DramaPost } from './models';

export async function fetchDramaPosts(): Promise<DramaPost[]> {
    const response = await fetch('https://api.example.com/drama-posts');
    if (!response.ok) {
        throw new Error('Failed to fetch drama posts');
    }
    const data = await response.json();
    return data.posts;
}