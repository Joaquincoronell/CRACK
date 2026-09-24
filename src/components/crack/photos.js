import part1 from '@/components/crack/photos-part1';
import part2 from '@/components/crack/photos-part2';
import part3 from '@/components/crack/photos-part3';
import part4 from '@/components/crack/photos-part4';

const files = { ...part1, ...part2, ...part3, ...part4 };

export const PHOTOS = Object.fromEntries(
  Object.entries(files).map(([name, [url, source]]) => [name, { url, source }])
);
