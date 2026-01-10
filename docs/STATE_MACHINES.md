# Машина состояний

## Title
- enter: показать меню
- action: start → Overworld

## Overworld
- update: клики по соседним клеткам, трата MP
- enter encounter → Battle(payload)

## Battle
- RTwP: cooldown tick
- pause: выбор своего стэка и цели
- end: победа → PostBattle(payload), поражение → GameOver

## PostBattle
- награды, VE/Gold, отчёт потерь
- action: Continue → Overworld
- action: Echo → Echo
- if boss: Continue → Victory

## Echo
- трата VE/Gold на эффекты "Эхо Времени"
- action: Back → Overworld

## Camp
- восстановление, найм, одноразовые баффы на следующий бой
- action: Back → Overworld

## GameOver
- поражение завершает сессию, очистка сейва
- action: Restart → Overworld (new run)

## Victory
- победа над боссом завершает сессию
- action: Restart/Menu

## Важно для расширения
- PostBattle как отдельное состояние позволит сделать выбор «Эхо» после боёв без захламления BattleState.
