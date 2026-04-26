import { Globe } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="border-t border-border/50 bg-card/50 mt-auto">
      <div className="container py-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary">
                <Globe className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold font-[Space_Grotesk]">Global Quiz Time Hub</span>
            </div>
            <p className="text-sm text-muted-foreground">Platform quiz, waktu dunia, dan berita kriminal terlengkap.</p>
          </div>
          <div>
            <h4 className="font-semibold mb-3 text-sm">Navigasi</h4>
            <div className="flex flex-col gap-1.5">
              <Link to="/quiz" className="text-sm text-muted-foreground hover:text-primary transition-colors story-link w-fit">Quiz</Link>
              <Link to="/world-clock" className="text-sm text-muted-foreground hover:text-primary transition-colors story-link w-fit">World Clock</Link>
              <Link to="/news" className="text-sm text-muted-foreground hover:text-primary transition-colors story-link w-fit">Berita</Link>
              <Link to="/translator" className="text-sm text-muted-foreground hover:text-primary transition-colors story-link w-fit">Translator</Link>
              <Link to="/media" className="text-sm text-muted-foreground hover:text-primary transition-colors story-link w-fit">Media</Link>
              <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-primary transition-colors story-link w-fit">Dashboard</Link>
            </div>
          </div>
          <div>
            <h4 className="font-semibold mb-3 text-sm">Informasi</h4>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm text-muted-foreground">191 negara & zona waktu</span>
              <span className="text-sm text-muted-foreground">6000+ soal latihan</span>
              <span className="text-sm text-muted-foreground">Multi-kategori & multi-level</span>
            </div>
          </div>
        </div>
        <div className="border-t border-border/50 mt-6 pt-4">
          <p className="text-xs text-muted-foreground text-center">© 2026 Global Quiz Time Hub. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
