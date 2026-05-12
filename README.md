# ESP32 — монітор освітленості (Serial → Node.js → SQLite → веб)

Публічний репозиторій: **https://github.com/kareevato/kursova-mikrokontrolery**

## Запуск

```bash
cd WEB
npm install
npm start
```

Відкрийте http://localhost:3000

- **USB / ESP:** закрийте Serial Monitor у Arduino IDE перед `npm start`.
- **Порт macOS:** за замовчуванням `SERIAL_PATH=/dev/cu.usbserial-0001`. Список портів: http://localhost:3000/api/ports  
- Якщо COM не потрібен: `SERIAL_ENABLE=false npm start`

## GitHub (з нуля через термінал)

Покрокова інструкція: **`docs/GITHUB-Z-NU-TERMINAL.md`**

Коротко:

```bash
gh auth login
cd "/Users/tetiana.karieieva/Documents/курсова"
chmod +x scripts/stvoriti-repo-github.sh
./scripts/stvoriti-repo-github.sh
```

## GitHub (вручну HTTPS)

Після створення **порожнього** репозиторію на github.com:

```bash
cd "/Users/tetiana.karieieva/Documents/курсова"
git remote add origin https://github.com/ВАШ_ЛОГІН/НАЗВА_РЕПО.git
git branch -M main
git push -u origin main
```

Якщо `git remote add` каже, що `origin` уже є: `git remote set-url origin https://github.com/...`
