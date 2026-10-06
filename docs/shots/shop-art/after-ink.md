# 화면에서 잰 잉크 상자(CHM-69)

`node tools/shots-shop-art.mjs --do measure`가 쓴다. 논리 칸 단위(@6x 캔버스 화소에서). 벗어남 = (왼 − 오른) / 2 · (위 − 아래) / 2.

## webkit

| 묶음 | 수 | 벗어남 0 아님 | 과녁 밖 | 예외 |
|---|---|---|---|---|
| art | 111 | 0 | 0 | evolve: |
| maxim-cell | 75 | 0 | 0 | - |
| scroll | 33 | 0 | 0 | evolve: |
| card-tab | 12 | 0 | 0 | - |
| card-art | 12 | 0 | 0 | chart:R · evolve: · piece:N |
| tab | 10 | 0 | 0 | - |
| band | 10 | 0 | 0 | - |
| envelope | 20 | 0 | 0 | - |

벗어남 0 · 과녁 밖 0

| 묶음 | 물건 | 칸 | 잉크 | 왼 · 오른 · 위 · 아래 |
|---|---|---|---|---|
| art | evolve: | 44×26 | 38×21.5 | 3 · 3 · 2.5 · 2 |
| scroll | evolve: | 18×22 | 12×10 | 3 · 3 · 6 · 6 |
| card-tab | maxim | 14×14 | 10×10 | 2 · 2 · 2 · 2 |
| card-art | maxim:chivalry | 22×26 | 16×16 | 3 · 3 · 5 · 5 |
| card-tab | maxim | 14×14 | 10×10 | 2 · 2 · 2 · 2 |
| card-art | maxim:vault | 22×26 | 16×16 | 3 · 3 · 5 · 5 |
| card-tab | chart | 14×14 | 10×10 | 2 · 2 · 2 · 2 |
| card-art | chart:R | 22×26 | 20×24 | 1 · 1 · 1 · 1 |
| card-tab | engraving | 14×14 | 10×10 | 2 · 2 · 2 · 2 |
| card-art | engraving:ebony | 22×26 | 14×16 | 4 · 4 · 5 · 5 |
| card-tab | soul | 14×14 | 10×10 | 2 · 2 · 2 · 2 |
| card-art | soul:spring | 22×26 | 16×16 | 3 · 3 · 5 · 5 |
| card-tab | evolve | 14×14 | 10×10 | 2 · 2 · 2 · 2 |
| card-art | evolve: | 44×26 | 38×21.5 | 3 · 3 · 2.5 · 2 |
| card-tab | tactic | 14×14 | 8×10 | 3 · 3 · 2 · 2 |
| card-art | tactic:freeze | 22×26 | 15×17 | 3.5 · 3.5 · 4.5 · 4.5 |
| card-tab | gamble | 14×14 | 8×10 | 3 · 3 · 2 · 2 |
| card-art | gamble:potion | 22×26 | 14×17 | 4 · 4 · 4.5 · 4.5 |
| card-tab | gamble | 14×14 | 8×10 | 3 · 3 · 2 · 2 |
| card-art | gamble:roulette | 22×26 | 16×18 | 3 · 3 · 4 · 4 |
| card-tab | piece | 14×14 | 8×10 | 3 · 3 · 2 · 2 |
| card-art | piece:N | 22×26 | 14×21.5 | 4 · 4 · 2.5 · 2 |
| card-tab | awaken | 14×14 | 10×8 | 2 · 2 · 3 · 3 |
| card-art | awaken: | 22×26 | 16×16 | 3 · 3 · 5 · 5 |
| card-tab | fragment | 14×14 | 10×10 | 2 · 2 · 2 · 2 |
| card-art | fragment: | 22×26 | 16×17 | 3 · 3 · 4.5 · 4.5 |
| tab | maxim | 14×14 | 10×10 | 2 · 2 · 2 · 2 |
| band | maxim | 14×26 | 10×10 | 2 · 2 · 8 · 8 |
| tab | chart | 14×14 | 10×10 | 2 · 2 · 2 · 2 |
| band | chart | 14×26 | 10×10 | 2 · 2 · 8 · 8 |
| tab | engraving | 14×14 | 10×10 | 2 · 2 · 2 · 2 |
| band | engraving | 14×26 | 10×10 | 2 · 2 · 8 · 8 |
| tab | soul | 14×14 | 10×10 | 2 · 2 · 2 · 2 |
| band | soul | 14×26 | 10×10 | 2 · 2 · 8 · 8 |
| tab | evolve | 14×14 | 10×10 | 2 · 2 · 2 · 2 |
| band | evolve | 14×26 | 10×10 | 2 · 2 · 8 · 8 |
| tab | tactic | 14×14 | 8×10 | 3 · 3 · 2 · 2 |
| band | tactic | 14×26 | 8×10 | 3 · 3 · 8 · 8 |
| tab | gamble | 14×14 | 8×10 | 3 · 3 · 2 · 2 |
| band | gamble | 14×26 | 8×10 | 3 · 3 · 8 · 8 |
| tab | piece | 14×14 | 8×10 | 3 · 3 · 2 · 2 |
| band | piece | 14×26 | 8×10 | 3 · 3 · 8 · 8 |
| tab | awaken | 14×14 | 10×8 | 2 · 2 · 3 · 3 |
| band | awaken | 14×26 | 10×8 | 2 · 2 · 9 · 9 |
| tab | fragment | 14×14 | 10×10 | 2 · 2 · 2 · 2 |
| band | fragment | 14×26 | 10×10 | 2 · 2 · 8 · 8 |
| envelope | piece 28×22 | 28×22 | 8×10 | 10 · 10 · 2 · 2 |
| envelope | piece 24×20 | 24×20 | 8×10 | 8 · 8 · 1 · 1 |
| envelope | piece 14×12 | 14×12 | 4×5 | 5 · 5 · 1 · 1 |
| envelope | piece 12×10 | 12×10 | 4×5 | 4 · 4 · 0.5 · 0.5 |
| envelope | chart 28×22 | 28×22 | 10×10 | 9 · 9 · 2 · 2 |
| envelope | chart 24×20 | 24×20 | 10×10 | 7 · 7 · 1 · 1 |
| envelope | chart 14×12 | 14×12 | 5×5 | 4.5 · 4.5 · 1 · 1 |
| envelope | chart 12×10 | 12×10 | 5×5 | 3.5 · 3.5 · 0.5 · 0.5 |
| envelope | engraving 28×22 | 28×22 | 10×10 | 9 · 9 · 2 · 2 |
| envelope | engraving 24×20 | 24×20 | 10×10 | 7 · 7 · 1 · 1 |
| envelope | engraving 14×12 | 14×12 | 5×5 | 4.5 · 4.5 · 1 · 1 |
| envelope | engraving 12×10 | 12×10 | 5×5 | 3.5 · 3.5 · 0.5 · 0.5 |
| envelope | golden 28×22 | 28×22 | 10×10 | 9 · 9 · 2 · 2 |
| envelope | golden 24×20 | 24×20 | 10×10 | 7 · 7 · 1 · 1 |
| envelope | golden 14×12 | 14×12 | 5×5 | 4.5 · 4.5 · 1 · 1 |
| envelope | golden 12×10 | 12×10 | 5×5 | 3.5 · 3.5 · 0.5 · 0.5 |
| envelope | piece 96×66 | 96×66 | 24×30 | 36 · 36 · 6.5 · 6.5 |
| envelope | chart 96×66 | 96×66 | 30×30 | 33 · 33 · 6.5 · 6.5 |
| envelope | engraving 96×66 | 96×66 | 30×30 | 33 · 33 · 6.5 · 6.5 |
| envelope | golden 96×66 | 96×66 | 30×30 | 33 · 33 · 6.5 · 6.5 |

## chromium

| 묶음 | 수 | 벗어남 0 아님 | 과녁 밖 | 예외 |
|---|---|---|---|---|
| art | 111 | 0 | 0 | evolve: |
| maxim-cell | 75 | 0 | 0 | - |
| scroll | 33 | 0 | 0 | evolve: |
| card-tab | 12 | 0 | 0 | - |
| card-art | 12 | 0 | 0 | chart:R · evolve: · piece:N |
| tab | 10 | 0 | 0 | - |
| band | 10 | 0 | 0 | - |
| envelope | 20 | 0 | 0 | - |

벗어남 0 · 과녁 밖 0

| 묶음 | 물건 | 칸 | 잉크 | 왼 · 오른 · 위 · 아래 |
|---|---|---|---|---|
| art | evolve: | 44×26 | 38×21.5 | 3 · 3 · 2.5 · 2 |
| scroll | evolve: | 18×22 | 12×10 | 3 · 3 · 6 · 6 |
| card-tab | maxim | 14×14 | 10×10 | 2 · 2 · 2 · 2 |
| card-art | maxim:chivalry | 22×26 | 16×16 | 3 · 3 · 5 · 5 |
| card-tab | maxim | 14×14 | 10×10 | 2 · 2 · 2 · 2 |
| card-art | maxim:vault | 22×26 | 16×16 | 3 · 3 · 5 · 5 |
| card-tab | chart | 14×14 | 10×10 | 2 · 2 · 2 · 2 |
| card-art | chart:R | 22×26 | 20×24 | 1 · 1 · 1 · 1 |
| card-tab | engraving | 14×14 | 10×10 | 2 · 2 · 2 · 2 |
| card-art | engraving:ebony | 22×26 | 14×16 | 4 · 4 · 5 · 5 |
| card-tab | soul | 14×14 | 10×10 | 2 · 2 · 2 · 2 |
| card-art | soul:spring | 22×26 | 16×16 | 3 · 3 · 5 · 5 |
| card-tab | evolve | 14×14 | 10×10 | 2 · 2 · 2 · 2 |
| card-art | evolve: | 44×26 | 38×21.5 | 3 · 3 · 2.5 · 2 |
| card-tab | tactic | 14×14 | 8×10 | 3 · 3 · 2 · 2 |
| card-art | tactic:freeze | 22×26 | 15×17 | 3.5 · 3.5 · 4.5 · 4.5 |
| card-tab | gamble | 14×14 | 8×10 | 3 · 3 · 2 · 2 |
| card-art | gamble:potion | 22×26 | 14×17 | 4 · 4 · 4.5 · 4.5 |
| card-tab | gamble | 14×14 | 8×10 | 3 · 3 · 2 · 2 |
| card-art | gamble:roulette | 22×26 | 16×18 | 3 · 3 · 4 · 4 |
| card-tab | piece | 14×14 | 8×10 | 3 · 3 · 2 · 2 |
| card-art | piece:N | 22×26 | 14×21.5 | 4 · 4 · 2.5 · 2 |
| card-tab | awaken | 14×14 | 10×8 | 2 · 2 · 3 · 3 |
| card-art | awaken: | 22×26 | 16×16 | 3 · 3 · 5 · 5 |
| card-tab | fragment | 14×14 | 10×10 | 2 · 2 · 2 · 2 |
| card-art | fragment: | 22×26 | 16×17 | 3 · 3 · 4.5 · 4.5 |
| tab | maxim | 14×14 | 10×10 | 2 · 2 · 2 · 2 |
| band | maxim | 14×26 | 10×10 | 2 · 2 · 8 · 8 |
| tab | chart | 14×14 | 10×10 | 2 · 2 · 2 · 2 |
| band | chart | 14×26 | 10×10 | 2 · 2 · 8 · 8 |
| tab | engraving | 14×14 | 10×10 | 2 · 2 · 2 · 2 |
| band | engraving | 14×26 | 10×10 | 2 · 2 · 8 · 8 |
| tab | soul | 14×14 | 10×10 | 2 · 2 · 2 · 2 |
| band | soul | 14×26 | 10×10 | 2 · 2 · 8 · 8 |
| tab | evolve | 14×14 | 10×10 | 2 · 2 · 2 · 2 |
| band | evolve | 14×26 | 10×10 | 2 · 2 · 8 · 8 |
| tab | tactic | 14×14 | 8×10 | 3 · 3 · 2 · 2 |
| band | tactic | 14×26 | 8×10 | 3 · 3 · 8 · 8 |
| tab | gamble | 14×14 | 8×10 | 3 · 3 · 2 · 2 |
| band | gamble | 14×26 | 8×10 | 3 · 3 · 8 · 8 |
| tab | piece | 14×14 | 8×10 | 3 · 3 · 2 · 2 |
| band | piece | 14×26 | 8×10 | 3 · 3 · 8 · 8 |
| tab | awaken | 14×14 | 10×8 | 2 · 2 · 3 · 3 |
| band | awaken | 14×26 | 10×8 | 2 · 2 · 9 · 9 |
| tab | fragment | 14×14 | 10×10 | 2 · 2 · 2 · 2 |
| band | fragment | 14×26 | 10×10 | 2 · 2 · 8 · 8 |
| envelope | piece 28×22 | 28×22 | 8×10 | 10 · 10 · 2 · 2 |
| envelope | piece 24×20 | 24×20 | 8×10 | 8 · 8 · 1 · 1 |
| envelope | piece 14×12 | 14×12 | 4×5 | 5 · 5 · 1 · 1 |
| envelope | piece 12×10 | 12×10 | 4×5 | 4 · 4 · 0.5 · 0.5 |
| envelope | chart 28×22 | 28×22 | 10×10 | 9 · 9 · 2 · 2 |
| envelope | chart 24×20 | 24×20 | 10×10 | 7 · 7 · 1 · 1 |
| envelope | chart 14×12 | 14×12 | 5×5 | 4.5 · 4.5 · 1 · 1 |
| envelope | chart 12×10 | 12×10 | 5×5 | 3.5 · 3.5 · 0.5 · 0.5 |
| envelope | engraving 28×22 | 28×22 | 10×10 | 9 · 9 · 2 · 2 |
| envelope | engraving 24×20 | 24×20 | 10×10 | 7 · 7 · 1 · 1 |
| envelope | engraving 14×12 | 14×12 | 5×5 | 4.5 · 4.5 · 1 · 1 |
| envelope | engraving 12×10 | 12×10 | 5×5 | 3.5 · 3.5 · 0.5 · 0.5 |
| envelope | golden 28×22 | 28×22 | 10×10 | 9 · 9 · 2 · 2 |
| envelope | golden 24×20 | 24×20 | 10×10 | 7 · 7 · 1 · 1 |
| envelope | golden 14×12 | 14×12 | 5×5 | 4.5 · 4.5 · 1 · 1 |
| envelope | golden 12×10 | 12×10 | 5×5 | 3.5 · 3.5 · 0.5 · 0.5 |
| envelope | piece 96×66 | 96×66 | 24×30 | 36 · 36 · 6.5 · 6.5 |
| envelope | chart 96×66 | 96×66 | 30×30 | 33 · 33 · 6.5 · 6.5 |
| envelope | engraving 96×66 | 96×66 | 30×30 | 33 · 33 · 6.5 · 6.5 |
| envelope | golden 96×66 | 96×66 | 30×30 | 33 · 33 · 6.5 · 6.5 |
