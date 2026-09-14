# Инструкция для Claude: проверка Jira → Obsidian AI-контракта

Проведи проверку полностью на локальной Jira и тестовом Obsidian vault. Продакшн
не трогай. Не печатай и не сохраняй значение `INF_PAT` в файлы, логи или Git.

## Исходные данные

- Jira: `http://localhost`
- API: `http://localhost/rest/asbis-inf/2.0`
- Серверная ветка: `feature/JIRA-850-ai-contract`
- Серверный коммит: `9ab1ba7a`
- Obsidian-репозиторий: `/mnt/ramdisk/obsidian-influencers`
- Obsidian-коммит: `3a0198a`
- Тестовый vault: `/mnt/ramdisk/obsidian-test-vault`
- Каталог установленного плагина:
  `/mnt/ramdisk/obsidian-test-vault/.obsidian/plugins/influencers`

## 1. Подготовь Jira

Убедись, что локальная Jira запущена и `INF_PAT` задан. Собери и разверни
серверную ветку `feature/JIRA-850-ai-contract` по обычной локальной процедуре
проекта `asbis-templates-2`. Не мержи её в `master` только ради проверки.

После развёртывания дождись готовности Jira и проверь endpoint:

```bash
curl -fsS \
  -H "Authorization: Bearer $INF_PAT" \
  http://localhost/rest/asbis-inf/2.0/ai/obsidian-card-contract \
  | jq '{version, fields:(.schema.properties.changes.properties | keys)}'
```

Ожидается `version: 1` и ровно шесть полей:

```text
agencyManager
commercialOfferUrl
email
internalRating
messenger
realName
```

Также проверь:

```bash
curl -fsS \
  -H "Authorization: Bearer $INF_PAT" \
  http://localhost/rest/asbis-inf/2.0/ai/obsidian-card-contract \
  | jq -e '
      .schema.additionalProperties == false and
      .schema.properties.changes.additionalProperties == false and
      (.prompt | contains("Managed by Influencer Sync"))
    '
```

## 2. Собери и установи Obsidian-плагин

```bash
cd /mnt/ramdisk/obsidian-influencers
npm test
npm run build
mkdir -p /mnt/ramdisk/obsidian-test-vault/.obsidian/plugins/influencers
cp main.js manifest.json \
  /mnt/ramdisk/obsidian-test-vault/.obsidian/plugins/influencers/
```

Перезапусти Obsidian либо выключи и снова включи `Influencer Sync`.

## 3. Проверь загрузку контракта

В Obsidian выполни `Influencer Sync: Download from Jira`.
В окне `Download cards from Jira?` нажми `Download from Jira`. До нажатия
кнопки запросы к реестру выполняться не должны.

Должны появиться:

```text
Influencers/_AI/influencer-card.schema.json
Influencers/_AI/AI-INSTRUCTIONS.md
```

Проверь файлы:

```bash
jq -e '
  .properties.changes.properties
  | keys
  | . == [
      "agencyManager",
      "commercialOfferUrl",
      "email",
      "internalRating",
      "messenger",
      "realName"
    ]
' /mnt/ramdisk/obsidian-test-vault/Influencers/_AI/influencer-card.schema.json

rg -n "Managed by Influencer Sync|Send local changes to Jira" \
  /mnt/ramdisk/obsidian-test-vault/Influencers/_AI/AI-INSTRUCTIONS.md
```

Повтори `Download from Jira`. Если серверный контракт не изменился, содержимое
обоих файлов должно остаться тем же.

## 4. Проверь, что чужой файл не затирается

Сохрани резервную копию `AI-INSTRUCTIONS.md`, замени исходный файл тестовым
текстом без служебного маркера и снова выполни `Download from Jira`.

Ожидается:

- уведомление `Refusing to overwrite unmanaged file`;
- тестовый текст не изменён;
- обычные карточки инфлюенсеров продолжают загружаться;
- в итоговом уведомлении одна ошибка AI-контракта.

После проверки восстанови исходный `AI-INSTRUCTIONS.md` из резервной копии.

## 5. Проверь работу AI по контракту

Выбери одну существующую тестовую карточку и сначала сохрани её исходное
содержимое. Попроси AI:

```text
Прочитай Influencers/_AI/AI-INSTRUCTIONS.md и указанную там JSON Schema.
В текущей карточке измени только messenger на @obsidian_ai_contract_test.
Другие поля, секции и маркеры не изменяй. Ничего не отправляй в Jira.
```

Перед отправкой проверь diff заметки. Разрешено изменение только строки
`messenger`. `influencerId`, `version`, `syncedAt`, read-only поля, заголовки и
`<!-- comments -->` должны остаться без изменений.

Выполни `Influencer Sync: Send local changes to Jira`. В окне
`Send changes to Jira?` нажми `Send to Jira`. Через API проверь, что:

- `messenger` стал `@obsidian_ai_contract_test`;
- `version` увеличилась ровно на один;
- остальные поля карточки не изменились.

Верни исходное значение `messenger` через заметку и повторно отправь изменение.

## 6. Проверь конфликт версий

1. Измени разрешённое поле в локальной заметке, но не отправляй.
2. Измени эту же карточку напрямую в Jira, чтобы серверная `version` выросла.
3. Выполни `Influencer Sync: Send local changes to Jira`.

Ожидается:

- серверное изменение не затёрто;
- повторного `PUT` с новой версией нет;
- заметка обновлена серверной версией;
- локальная правка помещена в `## Не отправлено (конфликт)`;
- показано уведомление о конфликте.

После проверки восстанови тестовую карточку.

## 7. Итоговый отчёт

Сообщи:

- версию установленного Jira-плагина;
- результат проверки endpoint;
- результат `npm test` и `npm run build`;
- созданы ли оба файла `_AI`;
- прошли ли защита чужого файла, AI-редактирование и конфликт версий;
- какие временные изменения были восстановлены.
