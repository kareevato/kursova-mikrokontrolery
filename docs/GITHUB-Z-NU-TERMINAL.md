# GitHub з нуля через термінал (macOS)

У папці проєкту вже є `git` і коміти. Далі — лише **вхід у GitHub** і **створення репозиторію**.

## Крок 1. Вхід (один раз на комп’ютер)

У Терміналі:

```bash
gh auth login
```

Рекомендовані відповіді:

1. **What account do you want to log into?** → `GitHub.com`  
2. **What is your preferred protocol?** → `HTTPS`  
3. **Authenticate Git with your GitHub credentials?** → `Yes`  
4. **How would you like to authenticate?** → `Login with a web browser`  

Скопіюйте код, відкриється браузер — підтвердіть.

Перевірка:

```bash
gh auth status
```

## Крок 2. Створити репозиторій і залити код

Перейдіть у папку курсової:

```bash
cd "/Users/tetiana.karieieva/Documents/курсова"
chmod +x scripts/stvoriti-repo-github.sh
./scripts/stvoriti-repo-github.sh
```

За замовчуванням ім’я репо: **`kursova-esp32-light`**. Своя назва (латиницею, без пробілів):

```bash
./scripts/stvoriti-repo-github.sh moya-kursova-esp32
```

Якщо скрипт каже, що **origin уже є**:

```bash
git remote remove origin
./scripts/stvoriti-repo-github.sh
```

## Вручну без скрипта (те саме)

```bash
cd "/Users/tetiana.karieieva/Documents/курсова"
gh repo create kursova-esp32-light --public --source=. --remote=origin --push
```

Після цього адреса буде виду: `https://github.com/<ваш-логін>/kursova-esp32-light`

## Якщо `gh auth login` не відкриває браузер

```bash
BROWSER=open gh auth login
```

Або оберіть варіант **Paste an authentication token** і вставте **Personal Access Token** з GitHub (Settings → Developer settings).
