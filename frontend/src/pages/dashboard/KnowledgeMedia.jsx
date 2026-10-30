import VideoGallery from '../public/VideoGallery';
import { AgriculturePhotoSections } from '../../components/layout/AgricultureShowcase';

export default function KnowledgeMedia() {
  return <div className="space-y-10">
    <AgriculturePhotoSections />
    <VideoGallery embedded />
  </div>;
}
