import { useState, useEffect } from 'react';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Badge,
  FreshnessBadge,
  Input,
  FormField,
  FormLabel,
  FormError,
  Modal,
  MacroRing,
  ConflictResolutionModal,
  RateLimitBanner,
  ToastContainer,
  ToastMessage,
} from './components/ui';
import {
  AlertCircle,
  Flame,
  Layers,
  Package,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  UtensilsCrossed,
} from 'lucide-react';
import { errorBus, ErrorListeners } from './api/errorHandler';
import { generateUuid } from './api/client';
import { ProblemDetails } from './types/api';

export function App() {
  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Rate Limiting simulation
  const [rateLimitSeconds, setRateLimitSeconds] = useState<number>(0);

  // 409 Conflict Modal
  const [isConflictOpen, setIsConflictOpen] = useState(false);

  // Generic Demo Modal
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);

  // Form error simulation for 400 VALIDATION_FAILED
  const [formQuantity, setFormQuantity] = useState<string>('500');
  const [formError, setFormError] = useState<string | null>(null);

  // Simulated Macro Progress
  const [macroData, setMacroData] = useState({
    calories: { current: 1680, target: 2200 },
    protein: { current: 135, target: 160 },
    fat: { current: 52, target: 70 },
    carbs: { current: 165, target: 230 },
  });

  const addToast = (toast: Omit<ToastMessage, 'id'>) => {
    const id = generateUuid();
    setToasts((prev) => [...prev, { ...toast, id }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Subscribe to errorBus events according to RFC 9457 reaction matrix
  useEffect(() => {
    const unsubs = [
      ErrorListeners.onRateLimitExceeded((data) => {
        setRateLimitSeconds(data.retryAfterSeconds);
        addToast({
          title: '429 Rate Limit Exceeded',
          description: `Кулдаун активовано на ${data.retryAfterSeconds} секунд.`,
          variant: 'warning',
        });
      }),

      ErrorListeners.onConcurrentModification((problem) => {
        setIsConflictOpen(true);
        addToast({
          title: '409 Conflict Detected',
          description: problem.detail || 'Дані змінено іншим учасником домогосподарства.',
          variant: 'warning',
          traceId: problem.traceId,
        });
      }),

      ErrorListeners.onItemNotFound((problem) => {
        addToast({
          title: '404 Item Not Found',
          description: problem.detail || 'Елемент уже був видалений іншим членом сімʼї.',
          variant: 'warning',
          traceId: problem.traceId,
        });
      }),

      ErrorListeners.onInsufficientInventory((problem) => {
        addToast({
          title: '422 Insufficient Inventory',
          description: problem.detail || 'Недостатня кількість продуктів для списання.',
          variant: 'error',
          traceId: problem.traceId,
        });
      }),

      ErrorListeners.onServerError((problem) => {
        addToast({
          title: '500 Server Error',
          description: problem.detail || 'Виникла помилка на сервері.',
          variant: 'error',
          traceId: problem.traceId,
        });
      }),
    ];

    return () => {
      unsubs.forEach((u) => u());
    };
  }, []);

  const handleSimulateValidationError = () => {
    const qty = parseFloat(formQuantity);
    if (isNaN(qty) || qty <= 0) {
      setFormError('Кількість повинна бути більшою за 0 (VALIDATION_FAILED: quantity > 0)');
      errorBus.emit<ProblemDetails>('validation-error', {
        type: 'https://ediens.app/errors/validation-failed',
        title: 'Validation Error',
        status: 400,
        errorCode: 'VALIDATION_FAILED',
        detail: 'Поле quantity повинно містити невідʼємне значення.',
      });
    } else {
      setFormError(null);
      addToast({
        title: 'Валідація пройдена',
        description: `Вказано ${qty} г/мл.`,
        variant: 'success',
      });
    }
  };

  const handleSimulateConflict = () => {
    errorBus.emit('concurrent-modification', {
      type: 'https://ediens.app/errors/concurrent-modification',
      title: 'Conflict during state modification',
      status: 409,
      detail: 'Складський залишок змінено користувачем Anna.',
      errorCode: 'CONCURRENT_MODIFICATION',
      traceId: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      extensions: {
        currentETag: 'W/"10425"',
        currentQuantity: 600,
        unit: 'ml',
      },
    });
  };

  const handleSimulateRateLimit = () => {
    errorBus.emit('rate-limit-exceeded', {
      retryAfterSeconds: 20,
      limit: 60,
      windowSeconds: 60,
    });
  };

  const handleSimulateItemNotFound = () => {
    errorBus.emit('item-not-found', {
      type: 'https://ediens.app/errors/item-not-found',
      title: 'Resource Not Found',
      status: 404,
      detail: 'Партію молока ID #0192e2b3 було списано або видалено.',
      errorCode: 'ITEM_NOT_FOUND',
      traceId: '00-8899aabbccddeeff0011223344556677-1122334455667788-01',
    });
  };

  const handleQuickAddMeal = () => {
    setMacroData((prev) => ({
      calories: { ...prev.calories, current: Math.min(prev.calories.target, prev.calories.current + 250) },
      protein: { ...prev.protein, current: Math.min(prev.protein.target, prev.protein.current + 20) },
      fat: { ...prev.fat, current: Math.min(prev.fat.target, prev.fat.current + 8) },
      carbs: { ...prev.carbs, current: Math.min(prev.carbs.target, prev.carbs.current + 25) },
    }));
    addToast({
      title: '1-Click Cook Залоговано',
      description: '+250 ккал | +20г білка додано до щоденника (Idempotency-Key валідний).',
      variant: 'success',
    });
  };

  return (
    <div className="min-h-screen bg-background text-zinc-100 flex flex-col antialiased">
      {/* Rate Limit Banner (RFC 9457 Reaction) */}
      {rateLimitSeconds > 0 && (
        <RateLimitBanner
          retryAfterSeconds={rateLimitSeconds}
          onTimerExpired={() => {
            setRateLimitSeconds(0);
            addToast({
              title: 'Кулдаун завершено',
              description: 'Ліміти запитів відновлено. Кнопки розблоковано.',
              variant: 'info',
            });
          }}
        />
      )}

      {/* Main Header */}
      <header className="border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-zinc-100 text-zinc-950 flex items-center justify-center font-bold font-mono text-base shadow-sm">
              ē
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-white">ēdiens</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                  UI Kit v1.0
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-none">
                Єдиний хаб запасів, макросів та рецептів
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="outline" dot className="hidden sm:inline-flex text-[11px]">
              PostgreSQL 17 xmin OCC
            </Badge>
            <Button
              variant="outline"
              size="sm"
              icon={<Sparkles className="h-3.5 w-3.5 text-amber-400" />}
              onClick={() => setIsDemoModalOpen(true)}
            >
              Специфікація UI Kit
            </Button>
          </div>
        </div>
      </header>

      {/* Body Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Intro Hero Card */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 relative overflow-hidden border-zinc-800/80">
            <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
              <UtensilsCrossed className="w-64 h-64 text-white" />
            </div>
            <CardHeader>
              <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 mb-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span>TASK-05 FOUNDATION ACTIVE</span>
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight text-white">
                ElevenLabs Monochrome UI Kit & RFC 9457 Client
              </CardTitle>
              <CardDescription className="text-zinc-400 text-sm max-w-xl">
                Модульна дизайн-система для управління складськими партіями за FEFO, оптимістичного блокування
                конфліктів через <code className="font-mono text-zinc-300">If-Match (ETag)</code> та реакції на помилки RFC 9457.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
                <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80">
                  <div className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold">Фреймворк</div>
                  <div className="text-sm font-semibold text-zinc-200 mt-0.5">React 19 + Vite</div>
                </div>
                <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80">
                  <div className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold">Стилі</div>
                  <div className="text-sm font-semibold text-zinc-200 mt-0.5">Tailwind ElevenLabs</div>
                </div>
                <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80">
                  <div className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold">HTTP Клієнт</div>
                  <div className="text-sm font-semibold text-zinc-200 mt-0.5">Axios + TraceContext</div>
                </div>
                <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80">
                  <div className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold">Помилки</div>
                  <div className="text-sm font-semibold text-zinc-200 mt-0.5">RFC 9457 Interceptor</div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-wrap gap-2.5">
              <Button
                variant="default"
                size="sm"
                icon={<Flame className="h-4 w-4 text-amber-500" />}
                onClick={handleQuickAddMeal}
              >
                1-Click Cook (+250 ккал)
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon={<RefreshCw className="h-3.5 w-3.5" />}
                onClick={() =>
                  setMacroData({
                    calories: { current: 1680, target: 2200 },
                    protein: { current: 135, target: 160 },
                    fat: { current: 52, target: 70 },
                    carbs: { current: 165, target: 230 },
                  })
                }
              >
                Скинути макроси
              </Button>
            </CardFooter>
          </Card>

          {/* Macro Progress Ring Card */}
          <Card className="flex flex-col items-center justify-center p-6 border-zinc-800/80">
            <CardHeader className="text-center p-0 pb-3 w-full">
              <CardTitle className="text-base font-semibold">Залишок макро-бюджету</CardTitle>
              <CardDescription>Динамічний перерахунок КБЖВ на день</CardDescription>
            </CardHeader>
            <CardContent className="p-0 flex flex-col items-center">
              <MacroRing
                calories={macroData.calories}
                protein={macroData.protein}
                fat={macroData.fat}
                carbs={macroData.carbs}
                size={170}
                strokeWidth={9}
              />
            </CardContent>
          </Card>
        </section>

        {/* RFC 9457 Reaction Matrix Testbench */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-400" />
            <h2 className="text-lg font-semibold tracking-tight text-white">
              RFC 9457 Problem Details Client Reaction Matrix
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 400 Validation Card */}
            <Card className="flex flex-col justify-between">
              <CardHeader>
                <Badge variant="outline" className="w-fit text-[10px] font-mono mb-1">
                  HTTP 400
                </Badge>
                <CardTitle className="text-sm">400 VALIDATION_FAILED</CardTitle>
                <CardDescription>
                  Підсвітка помилок форми біля полів вводу за схемою RFC 9457.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <FormField>
                  <FormLabel htmlFor="qty-input">Вага продукту (г):</FormLabel>
                  <Input
                    id="qty-input"
                    value={formQuantity}
                    onChange={(e) => {
                      setFormQuantity(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    error={Boolean(formError)}
                    suffix="г"
                  />
                  <FormError message={formError} />
                </FormField>
              </CardContent>
              <CardFooter>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={handleSimulateValidationError}
                >
                  Перевірити (спробуйте 0 або -10)
                </Button>
              </CardFooter>
            </Card>

            {/* 409 Conflict Card */}
            <Card className="flex flex-col justify-between">
              <CardHeader>
                <Badge variant="outline" className="w-fit text-[10px] font-mono mb-1">
                  HTTP 409
                </Badge>
                <CardTitle className="text-sm">409 CONCURRENT_MODIFICATION</CardTitle>
                <CardDescription>
                  Невідповідність ETag (PostgreSQL xmin) при одночасному списанні партій.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Відкриває <code className="font-mono text-zinc-300">&lt;ConflictResolutionModal&gt;</code> з порівнянням
                  серверного залишку та пропозицією вибору з 3 варіантів дій.
                </p>
              </CardContent>
              <CardFooter>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full text-xs"
                  onClick={handleSimulateConflict}
                >
                  Змоделювати конфлікт ETag
                </Button>
              </CardFooter>
            </Card>

            {/* 429 Rate Limit Card */}
            <Card className="flex flex-col justify-between">
              <CardHeader>
                <Badge variant="outline" className="w-fit text-[10px] font-mono mb-1">
                  HTTP 429
                </Badge>
                <CardTitle className="text-sm">429 RATE_LIMIT_EXCEEDED</CardTitle>
                <CardDescription>
                  Перевищення ліміту сканування штрих-кодів або AI-рекомендацій.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Відображає <code className="font-mono text-zinc-300">&lt;RateLimitBanner&gt;</code> із живим зворотним
                  відліком секунд з заголовка <code className="font-mono text-zinc-300">Retry-After</code>.
                </p>
              </CardContent>
              <CardFooter>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  disabled={rateLimitSeconds > 0}
                  onClick={handleSimulateRateLimit}
                >
                  {rateLimitSeconds > 0 ? `Кулдаун (${rateLimitSeconds}с)` : 'Змоделювати Rate Limit (20с)'}
                </Button>
              </CardFooter>
            </Card>

            {/* 404 / 422 Events Card */}
            <Card className="flex flex-col justify-between">
              <CardHeader>
                <Badge variant="outline" className="w-fit text-[10px] font-mono mb-1">
                  HTTP 404 / 422
                </Badge>
                <CardTitle className="text-sm">404 & 422 Доменні реакції</CardTitle>
                <CardDescription>
                  Видалені товари та недостатня кількість інгредієнтів.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs border border-zinc-800"
                  onClick={handleSimulateItemNotFound}
                >
                  <AlertCircle className="h-3.5 w-3.5 text-amber-400 mr-2" />
                  404 ITEM_NOT_FOUND Toast
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs border border-zinc-800"
                  onClick={() =>
                    errorBus.emit('insufficient-inventory', {
                      status: 422,
                      errorCode: 'INSUFFICIENT_INVENTORY',
                      detail: 'Не вистачає 150г курячого філе для приготування.',
                    })
                  }
                >
                  <Package className="h-3.5 w-3.5 text-rose-400 mr-2" />
                  422 INSUFFICIENT_INVENTORY
                </Button>
              </CardContent>
              <CardFooter>
                <div className="text-[11px] text-zinc-500 font-mono w-full text-center">
                  Автоматичне керування чергою
                </div>
              </CardFooter>
            </Card>
          </div>
        </section>

        {/* FEFO Badges & UI Elements Showcase */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-sky-400" />
            <h2 className="text-lg font-semibold tracking-tight text-white">
              FEFO Badges & Design System Elements
            </h2>
          </div>

          <Card>
            <CardContent className="p-6 space-y-6">
              {/* FEFO Statuses */}
              <div>
                <div className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-3">
                  Динамічні FEFO-індикатори придатності:
                </div>
                <div className="flex flex-wrap gap-3">
                  <FreshnessBadge status="FRESH" days={8} />
                  <FreshnessBadge status="EXPIRING_SOON" days={2} />
                  <FreshnessBadge status="CRITICAL" days={0} />
                  <FreshnessBadge status="EXPIRED" />
                  <Badge variant="offline" dot>
                    OFFLINE_MODE
                  </Badge>
                </div>
              </div>

              {/* Button Variants */}
              <div>
                <div className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-3">
                  Кнопки (ElevenLabs Button Suite):
                </div>
                <div className="flex flex-wrap gap-2.5">
                  <Button variant="default">Primary Button</Button>
                  <Button variant="secondary">Secondary Button</Button>
                  <Button variant="outline">Outline Button</Button>
                  <Button variant="ghost">Ghost Button</Button>
                  <Button variant="danger">Danger Action</Button>
                  <Button variant="default" loading>
                    Saving
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-6 text-center text-xs text-zinc-500">
        <p>ēdiens Frontend Foundation • React 19 • Vite • Tailwind CSS • RFC 9457 Compliant</p>
      </footer>

      {/* 409 Conflict Resolution Modal */}
      <ConflictResolutionModal
        isOpen={isConflictOpen}
        onClose={() => setIsConflictOpen(false)}
        itemName="Молоко 'Селянське' 2.5%"
        attemptedQuantity={400}
        currentServerQuantity={600}
        unit="ml"
        currentETag='W/"10425"'
        modifiedBy="користувачем Anna"
        onAcceptServer={() => {
          addToast({
            title: 'Конфлікт вирішено',
            description: 'Прийнято актуальний залишок сервера (600 ml).',
            variant: 'success',
          });
        }}
        onReapplyWithServerQuantity={(newQty, etag) => {
          addToast({
            title: 'Списання скориговано',
            description: `Запит відправлено з новим If-Match: ${etag || 'W/"10425"'} (новий залишок: ${newQty} ml).`,
            variant: 'success',
          });
        }}
      />

      {/* Demo Modal */}
      <Modal
        isOpen={isDemoModalOpen}
        onClose={() => setIsDemoModalOpen(false)}
        title="Специфікація ElevenLabs UI Kit"
        description="Архітектурні особливості компонентальної бібліотеки ēdiens."
        footer={
          <Button variant="default" size="sm" onClick={() => setIsDemoModalOpen(false)}>
            Зрозуміло
          </Button>
        }
      >
        <div className="space-y-3 text-xs text-zinc-300 leading-relaxed">
          <p>
            Компонентна база реалізована з урахуванням високої контрастності, мінімалістичних монохромних рамок
            <code className="text-zinc-200 font-mono"> border-zinc-800</code>, темного фону
            <code className="text-zinc-200 font-mono"> bg-zinc-950</code> та мікро-анімацій натискання.
          </p>
          <p>
            Усі помилки мережі обробляються централізовано через
            <code className="text-zinc-200 font-mono"> errorHandler.ts</code>, що гарантує 100% відповідність
            стандарту RFC 9457 та специфікації OpenAPI.
          </p>
        </div>
      </Modal>

      {/* Global Toast Container */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}

export default App;
