import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { BookOpen, Clock, Newspaper, BarChart3, Globe, Shield, Zap, Trophy } from 'lucide-react';
import Premium3DHero from '@/components/experience/Premium3DHero';
import InteractiveGlobe from '@/components/experience/InteractiveGlobe';

const features = [
  { icon: BookOpen, title: 'Quiz Multi-Kategori', desc: '6000+ soal dari Matematika, Akuntansi, CPNS, PPPK, IELTS, dan JLPT', href: '/quiz', color: 'from-violet-500 to-purple-600' },
  { icon: Clock, title: 'Waktu Dunia', desc: 'Jam real-time 191 negara dengan zona waktu IANA', href: '/world-clock', color: 'from-emerald-500 to-teal-600' },
  { icon: Newspaper, title: 'Berita Kriminal', desc: 'Info keamanan digital, penipuan, scam, dan cybercrime', href: '/news', color: 'from-rose-500 to-pink-600' },
  { icon: BarChart3, title: 'Dashboard & Riwayat', desc: 'Statistik, grafik progres, dan riwayat lengkap', href: '/dashboard', color: 'from-amber-500 to-orange-600' },
];

const stats = [
  { icon: Globe, value: '191', label: 'Negara' },
  { icon: BookOpen, value: '6000+', label: 'Soal' },
  { icon: Trophy, value: '6', label: 'Kategori' },
  { icon: Shield, value: '100%', label: 'Aman' },
];

const easeOut = [0.22, 1, 0.36, 1] as const;

export default function Index() {
  return (
    <div>
      <Premium3DHero />

      {/* Stats */}
      <section className="py-10 sm:py-12 border-y border-border/50 bg-card/30 backdrop-blur">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.4, delay: i * 0.08, ease: easeOut }}
                className="text-center group depth-card rounded-2xl p-3"
              >
                <s.icon className="h-7 w-7 sm:h-8 sm:w-8 mx-auto mb-2 text-primary group-hover:scale-110 transition-transform duration-300" />
                <p className="text-2xl sm:text-3xl font-bold font-[Space_Grotesk]">{s.value}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <InteractiveGlobe />

      {/* Features */}
      <section className="py-16 sm:py-20">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, ease: easeOut }}
            className="text-center mb-10 sm:mb-12"
          >
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-[Space_Grotesk] mb-3">Fitur Unggulan</h2>
            <p className="text-muted-foreground max-w-lg mx-auto text-sm sm:text-base">Semua yang kamu butuhkan untuk belajar dan tetap update tentang dunia.</p>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 max-w-4xl mx-auto">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.45, delay: i * 0.1, ease: easeOut }}
              >
                <Link to={f.href} className="block h-full">
                  <Card className="group card-hover depth-card border-border/50 h-full overflow-hidden">
                    <CardContent className="p-5 sm:p-6">
                      <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${f.color} mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                        <f.icon className="h-6 w-6 text-white" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">{f.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-20 bg-gradient-to-br from-primary/5 to-accent/5">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: easeOut }}
          className="container text-center"
        >
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-[Space_Grotesk] mb-4">Siap Memulai?</h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto text-sm sm:text-base">Daftar gratis dan mulai latihan quiz dari 6 kategori berbeda.</p>
          <Link to="/auth">
            <Button size="lg" className="bg-gradient-primary hover:opacity-90 text-white px-8 hover-scale shadow-elevated">
              <Zap className="mr-2 h-5 w-5" />
              Daftar Sekarang
            </Button>
          </Link>
        </motion.div>
      </section>
    </div>
  );
}
