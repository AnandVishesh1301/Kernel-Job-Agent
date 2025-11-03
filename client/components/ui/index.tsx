export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export function Button({ className, variant = 'primary', ...props }: any) {
  const v = variant === 'outline' ? 'btn-outline' : 'btn-primary';
  return <button className={cn('btn', v, className)} {...props} />;
}

export function Badge({ className, color = 'gray', ...props }: any) {
  const c = {
    green: 'badge-green',
    red: 'badge-red',
    yellow: 'badge-yellow',
    gray: 'badge-gray',
  }[color] || 'badge-gray';
  return <span className={cn('badge', c, className)} {...props} />;
}

export function Card({ className, children }: any) {
  return <div className={cn('card', className)}>{children}</div>;
}
export function CardHeader({ className, children }: any) {
  return <div className={cn('card-header', className)}>{children}</div>;
}
export function CardBody({ className, children }: any) {
  return <div className={cn('card-body', className)}>{children}</div>;
}


