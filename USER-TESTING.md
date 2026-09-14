# Проверка Influencer Sync в Obsidian

## 1. Откройте Obsidian

Откройте рабочее хранилище Obsidian.

Если Obsidian ещё не установлен, скачайте его с официальной страницы:
https://obsidian.md/download

## 2. Установите плагин

1. Получите файлы `main.js` и `manifest.json` плагина.
2. Откройте папку своего хранилища Obsidian.
3. Перейдите в скрытую папку `.obsidian/plugins`.
4. Создайте внутри неё папку `influencers`.
5. Скопируйте в неё `main.js` и `manifest.json`.
6. Перезапустите Obsidian.

Итоговая структура должна выглядеть так:

```text
<ваше хранилище>/.obsidian/plugins/influencers/main.js
<ваше хранилище>/.obsidian/plugins/influencers/manifest.json
```

## 3. Включите плагин

1. Откройте `Settings`.
2. Перейдите в `Community plugins`.
3. Включите `Influencer Sync`.

## 4. Настройте подключение к Jira

В настройках `Influencer Sync` укажите:

- адрес Jira API;
- персональный токен Jira;
- папку карточек `Influencers`;
- интервал синхронизации.

Не отправляйте персональный токен другим пользователям и не добавляйте его в
заметки.

## 5. Загрузите карточки из Jira

1. Откройте палитру команд: `Ctrl+P`.
2. Выберите `Influencer Sync: Download from Jira`.
3. В окне `Download cards from Jira?` проверьте направление
   `Jira → Obsidian`.
4. Нажмите `Download from Jira`.
5. Дождитесь уведомления `Influencers downloaded`.

В папке `Influencers` должны появиться карточки. В папке `Influencers/_AI`
должны появиться:

- `AI-INSTRUCTIONS.md`;
- `influencer-card.schema.json`.

## 6. Измените тестовую карточку

Откройте существующую карточку инфлюенсера. Можно изменить только:

- `realName`;
- `email`;
- `messenger`;
- `agencyManager`;
- `commercialOfferUrl`;
- `internalRating`.

Новый комментарий добавляйте только ниже строки:

```html
<!-- comments -->
```

Не изменяйте `influencerId`, `version`, `syncedAt`, статус и вычисляемые поля.

## 7. Отправьте изменения в Jira

1. Откройте палитру команд: `Ctrl+P`.
2. Выберите `Influencer Sync: Send local changes to Jira`.
3. В окне `Send changes to Jira?` проверьте направление
   `Obsidian → Jira`.
4. Нажмите `Send to Jira`.
5. Дождитесь уведомления `Changes sent and notes refreshed`.

Откройте карточку в Jira и убедитесь, что изменённое поле или комментарий
появились.

## 8. Отмена операции

Кнопка `Cancel` закрывает окно. Карточки не загружаются и не отправляются.

## 9. Конфликт изменений

Если карточку одновременно изменили в Jira, плагин не затирает чужую версию.
Локальная правка останется в разделе `Не отправлено (конфликт)` внутри заметки.
Такую правку нужно проверить и применить вручную.
