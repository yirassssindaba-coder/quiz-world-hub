import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SkeletonBlock } from '@/components/SkeletonCard';
import { Search, MapPin, Clock, Globe, Languages } from 'lucide-react';

interface Country {
  id: string; name: string; capital: string; continent: string;
  timezone_iana: string; utc_offset: string | null; languages: string | null;
}

const continents = ['Semua', 'Afrika', 'Amerika', 'Asia', 'Eropa', 'Oseania'];

function useCurrentTime(timezone: string) {
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');
  useEffect(() => {
    const update = () => {
      try {
        const now = new Date();
        setTime(now.toLocaleTimeString('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        setDate(now.toLocaleDateString('id-ID', { timeZone: timezone, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }));
      } catch { setTime('--:--:--'); setDate('--'); }
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [timezone]);
  return { time, date };
}

function CountryCard({ country, onClick, index }: { country: Country; onClick: () => void; index: number }) {
  const { time, date } = useCurrentTime(country.timezone_iana);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.02, 0.3), ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className="group card-hover border-border/50 cursor-pointer h-full" onClick={onClick}>
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start justify-between mb-3 gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold truncate">{country.name}</h3>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{country.capital}</span>
              </p>
            </div>
            <Badge variant="outline" className="shrink-0 text-xs font-mono">{country.utc_offset || ''}</Badge>
          </div>
          <div className="text-2xl sm:text-3xl font-mono font-bold tracking-wider text-primary mb-1 group-hover:scale-105 origin-left transition-transform">{time}</div>
          <p className="text-xs text-muted-foreground">{date}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function CountryDetail({ country }: { country: Country }) {
  const { time, date } = useCurrentTime(country.timezone_iana);
  return (
    <div className="space-y-4">
      <div className="text-center p-6 rounded-xl bg-muted/50">
        <div className="text-5xl font-mono font-bold tracking-wider text-primary mb-2">{time}</div>
        <p className="text-sm text-muted-foreground">{date}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: MapPin, label: 'Ibu Kota', value: country.capital },
          { icon: Globe, label: 'Benua', value: country.continent },
          { icon: Clock, label: 'Zona Waktu', value: country.timezone_iana },
          { icon: Languages, label: 'Bahasa', value: country.languages || '-' },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-2 p-3 rounded-lg bg-muted/30">
            <item.icon className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="text-sm font-medium truncate">{item.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function WorldClock() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [continent, setContinent] = useState('Semua');
  const [selected, setSelected] = useState<Country | null>(null);

  useEffect(() => {
    supabase.from('countries').select('*').order('name').then(({ data }) => {
      setCountries(data || []);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    return countries.filter(c => {
      const matchSearch = search === '' || c.name.toLowerCase().includes(search.toLowerCase()) || c.capital.toLowerCase().includes(search.toLowerCase());
      const matchContinent = continent === 'Semua' || c.continent === continent;
      return matchSearch && matchContinent;
    });
  }, [countries, search, continent]);

  if (loading) {
    return (
      <div className="container py-8 sm:py-12">
        <SkeletonBlock className="h-9 w-64 mb-3" />
        <SkeletonBlock className="h-4 w-96 max-w-full mb-8" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(12)].map((_, i) => <SkeletonBlock key={i} className="h-36" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8 sm:py-12">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mb-8">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-[Space_Grotesk] mb-2">Waktu Dunia Real-Time</h1>
        <p className="text-sm sm:text-base text-muted-foreground">Jam digital real-time dari {countries.length} negara dengan zona waktu IANA.</p>
      </motion.div>
      <div className="flex flex-col sm:flex-row gap-3 mb-6 sm:mb-8">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cari negara atau ibu kota..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 transition-all focus-visible:ring-2" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {continents.map(c => (
            <Button key={c} variant={continent === c ? 'default' : 'outline'} size="sm" onClick={() => setContinent(c)}
              className={`hover-scale ${continent === c ? 'bg-gradient-primary text-white' : ''}`}>{c}</Button>
          ))}
        </div>
      </div>
      <p className="text-sm text-muted-foreground mb-4">{filtered.length} negara ditemukan</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {filtered.map((c, i) => <CountryCard key={c.id} country={c} onClick={() => setSelected(c)} index={i} />)}
      </div>
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-xl font-[Space_Grotesk]">{selected?.name}</DialogTitle></DialogHeader>
          {selected && <CountryDetail country={selected} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
