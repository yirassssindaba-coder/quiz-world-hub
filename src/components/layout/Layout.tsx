import Navbar from './Navbar';
import Footer from './Footer';
import GlobalMediaPlayer from '@/components/media/GlobalMediaPlayer';
import Intro3D from '@/components/experience/Intro3D';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
      <GlobalMediaPlayer />
      <Intro3D />
    </div>
  );
}
