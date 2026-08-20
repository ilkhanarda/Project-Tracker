# Neon PostgreSQL kurulumu

Backend artık Neon PostgreSQL ve Drizzle `neon-http` sürücüsünü kullanır.
Eski SQLite veritabanı ve migration dosyaları silinmemiştir.

## 1. Bağlantı adresini ekle

Neon Console içindeki **Connection Details** bölümünden pooled connection string'i
kopyala ve kök `.env` dosyasına ekle:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST/neondb?sslmode=require
DB_FILE_NAME=data/project-tracking.db
```

`.env` Git tarafından takip edilmez; bağlantı şifresini repoya commit etme.

## 2. PostgreSQL tablolarını oluştur

```bash
npm run db:migrate
```

Bu komut `drizzle-neon/` altındaki PostgreSQL migration'ını Neon'a uygular.

## 3. Mevcut SQLite kayıtlarını aktar

```bash
npm run db:migrate:sqlite
```

Aktarım kullanıcıları, projeleri, görevleri, oturumları ve auth tokenlarını kimlik
değerlerini koruyarak taşır. Komut yeniden çalıştırıldığında mevcut primary/unique
key kayıtlarını atlar.

## 4. Backend'i çalıştır

```bash
npm run dev
```

Yeni kayıtların Neon'a yazıldığını `npm run db:studio` veya Neon SQL Editor ile
kontrol edebilirsin.
